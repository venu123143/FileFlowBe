import 'dotenv/config';
import secondaryS3Service from '@/config/s3-secondary.config';
import primaryS3Service, { FolderNameEnum } from '@/config/s3.config';

import fs from 'fs';
import path from 'path';
import os from 'os';

interface MigrationResult {
    successful: string[];
    failed: Array<{ key: string; error: string }>;
    skipped: string[];
    totalFiles: number;
    totalSize: number;
    startTime: Date;
    endTime?: Date;
}

class StorageMigration {
    private result: MigrationResult = {
        successful: [],
        failed: [],
        skipped: [],
        totalFiles: 0,
        totalSize: 0,
        startTime: new Date(),
    };
    private skipExisting: boolean;

    constructor(skipExisting: boolean = false) {
        this.skipExisting = skipExisting;
    }

    /**
     * Migrate files from secondary storage to primary storage
     * @param sourceFolder - Folder to migrate from secondary storage
     * @param targetFolder - Target folder in primary storage (defaults to same as source)
     */
    async migrateFolder(sourceFolder: FolderNameEnum, targetFolder: FolderNameEnum = FolderNameEnum.IMAGES) {
        console.log(`\n🚀 Starting migration from secondary storage (${sourceFolder}) to primary storage (${targetFolder})`);
        console.log(`⏰ Started at: ${this.result.startTime.toISOString()}`);
        console.log(`💾 Available Memory: ${this.formatBytes(os.freemem())} / ${this.formatBytes(os.totalmem())}`);
        console.log(`📋 Skip existing files: ${this.skipExisting ? 'Yes' : 'No'}\n`);

        let continuationToken: string | undefined;
        let batchNumber = 1;

        do {
            console.log(`📦 Processing batch ${batchNumber}...`);
            // Process 100 files at a time
            const listResult = await secondaryS3Service.listFiles(sourceFolder, 100, continuationToken);

            this.result.totalFiles += listResult.files.length;

            // Process files one at a time for large video files to avoid memory and timeout issues
            const CONCURRENT_UPLOADS = 1;
            for (let i = 0; i < listResult.files.length; i += CONCURRENT_UPLOADS) {
                const batch = listResult.files.slice(i, i + CONCURRENT_UPLOADS);
                await Promise.all(
                    batch.map(file => this.migrateFile(file.key, targetFolder, file.size))
                );
            }

            continuationToken = listResult.nextContinuationToken;
            batchNumber++;

            console.log(`✅ Batch ${batchNumber - 1} completed. Progress: ${this.result.successful.length}/${this.result.totalFiles} successful\n`);

        } while (continuationToken);

        this.result.endTime = new Date();
        this.printSummary();
        this.saveResultsToFile();
    }

    /**
     * Check if file already exists in primary storage with retry logic
     */
    private async fileExists(fileName: string, targetFolder: FolderNameEnum): Promise<boolean> {
        const key = `${targetFolder}/${fileName}`;
        const maxRetries = 3;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await primaryS3Service.getMetadata(key);
                return true;
            } catch (error: any) {
                // If it's a 404/not found error, file doesn't exist
                if (error?.name === 'NotFound' || error?.$metadata?.httpStatusCode === 404) {
                    return false;
                }
                
                // For other errors (rate limit, network), retry with backoff
                if (attempt < maxRetries) {
                    const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s
                    console.log(`    ⚠️  Retry ${attempt}/${maxRetries} checking existence after ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    // After all retries failed, assume file doesn't exist (safer to re-upload than skip)
                    console.log(`    ⚠️  Could not verify existence, will attempt migration`);
                    return false;
                }
            }
        }
        
        return false;
    }

    /**
     * Migrate a single file using streaming to avoid memory issues
     */
    private async migrateFile(key: string, targetFolder: FolderNameEnum, fileSize: number): Promise<void> {
        const fileName = key.split('/').pop() || key;

        try {
            // Check if we should skip existing files
            if (this.skipExisting) {
                const exists = await this.fileExists(fileName, targetFolder);
                if (exists) {
                    this.result.skipped.push(key);
                    console.log(`  ⏭️  Skipped (already exists): ${key}`);
                    return;
                }
            }

            console.log(`  📄 Migrating: ${key} (${this.formatBytes(fileSize)})`);

            // Check available memory before processing
            const freeMem = os.freemem();
            const MIN_MEMORY = 500 * 1024 * 1024; // 500 MB minimum
            
            if (freeMem < MIN_MEMORY) {
                throw new Error(`Insufficient memory: ${this.formatBytes(freeMem)} available`);
            }

            // Add delay between files to avoid rate limiting (100ms)
            await new Promise(resolve => setTimeout(resolve, 100));

            // Get file metadata from secondary storage with retry
            let metadata: Awaited<ReturnType<typeof secondaryS3Service.getMetadata>> | undefined;
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    metadata = await secondaryS3Service.getMetadata(key);
                    break;
                } catch (error) {
                    if (attempt === 3) throw error;
                    const delay = attempt * 2000;
                    console.log(`    ⚠️  Retry ${attempt}/3 getting metadata after ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
            
            if (!metadata) {
                throw new Error('Failed to get metadata after 3 attempts');
            }

            // For videos, use buffer method with timeout
            console.log(`    ⬇️  Downloading from R2...`);
            
            // Increase timeout for very large files (10 minutes for files > 400MB)
            const downloadTimeout = fileSize > 400 * 1024 * 1024 ? 600000 : 300000;
            const fileBuffer = await Promise.race([
                secondaryS3Service.getFile(key),
                new Promise<Buffer>((_, reject) => 
                    setTimeout(() => reject(new Error(`Download timeout after ${downloadTimeout/1000/60} minutes`)), downloadTimeout)
                )
            ]);
            
            console.log(`    ⬆️  Uploading to Hetzner...`);
            
            // Retry upload with exponential backoff
            let uploadSuccess = false;
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    await Promise.race([
                        primaryS3Service.uploadBuffer(
                            fileName,
                            fileBuffer,
                            fileName,
                            metadata.contentType || 'application/octet-stream',
                            targetFolder
                        ),
                        new Promise((_, reject) => 
                            setTimeout(() => reject(new Error(`Upload timeout after ${downloadTimeout/1000/60} minutes`)), downloadTimeout)
                        )
                    ]);
                    uploadSuccess = true;
                    break;
                } catch (error) {
                    if (attempt === 3) throw error;
                    const delay = Math.pow(2, attempt) * 2000;
                    console.log(`    ⚠️  Upload retry ${attempt}/3 after ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
            
            if (!uploadSuccess) {
                throw new Error('Upload failed after 3 attempts');
            }

            this.result.totalSize += fileSize;
            this.result.successful.push(key);
            console.log(`  ✅ Success: ${key}`);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.result.failed.push({ key, error: errorMessage });
            console.error(`  ❌ Failed: ${key} - ${errorMessage}`);
            
            // Force garbage collection hint for large file failures
            if (global.gc) {
                global.gc();
            }
        }
    }

    /**
     * Print migration summary
     */
    private printSummary() {
        const duration = this.result.endTime && this.result.startTime
            ? (this.result.endTime.getTime() - this.result.startTime.getTime()) / 1000
            : 0;

        console.log('\n' + '='.repeat(80));
        console.log('📊 MIGRATION SUMMARY');
        console.log('='.repeat(80));
        console.log(`Total Files Processed: ${this.result.totalFiles}`);
        console.log(`✅ Successful: ${this.result.successful.length}`);
        console.log(`⏭️  Skipped (already exist): ${this.result.skipped.length}`);
        console.log(`❌ Failed: ${this.result.failed.length}`);
        console.log(`💾 Total Data Migrated: ${this.formatBytes(this.result.totalSize)}`);
        console.log(`⏱️  Duration: ${duration.toFixed(2)} seconds`);
        console.log(`📅 Started: ${this.result.startTime.toISOString()}`);
        console.log(`📅 Ended: ${this.result.endTime?.toISOString()}`);
        console.log('='.repeat(80));

        if (this.result.failed.length > 0) {
            console.log('\n❌ FAILED FILES:');
            console.log('-'.repeat(80));
            this.result.failed.forEach(({ key, error }) => {
                console.log(`  • ${key}`);
                console.log(`    Error: ${error}`);
            });
        }
    }

    /**
     * Save migration results to a JSON file
     */
    private saveResultsToFile() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `migration-report-${timestamp}.json`;
        const filePath = path.join(process.cwd(), 'logs', fileName);

        // Create logs directory if it doesn't exist
        const logsDir = path.join(process.cwd(), 'logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }

        fs.writeFileSync(filePath, JSON.stringify(this.result, null, 2));
        console.log(`\n📄 Detailed report saved to: ${filePath}`);
    }

    /**
     * Format bytes to human-readable format
     */
    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }
}

// Main execution
async function main() {
    try {
        console.log('🔧 Environment Check:');
        console.log('  Secondary S3 Endpoint:', process.env.SECONDARY_S3_ENDPOINT);
        console.log('  Secondary S3 Bucket:', process.env.SECONDARY_S3_BUCKET_NAME);
        console.log('  Primary S3 Endpoint:', process.env.S3_ENDPOINT);
        console.log('  Primary S3 Bucket:', process.env.S3_BUCKET_NAME);

        if (!process.env.SECONDARY_S3_TOKEN_ID ||
            !process.env.SECONDARY_S3_SECRET_KEY ||
            !process.env.SECONDARY_S3_ENDPOINT ||
            !process.env.SECONDARY_S3_BUCKET_NAME) {
            throw new Error('Missing required secondary S3 environment variables');
        }

        // Set skipExisting to true to resume from where it crashed
        const SKIP_EXISTING_FILES = true;
        const migration = new StorageMigration(SKIP_EXISTING_FILES);

        // Migrate videos folder from secondary (R2) to primary (Hetzner)
        await migration.migrateFolder(FolderNameEnum.VIDEOS, FolderNameEnum.VIDEOS);

        console.log('\n✨ Migration completed successfully!');
        process.exit(0);

    } catch (error) {
        console.error('\n💥 Migration failed:', error);
        process.exit(1);
    }
}

// Run the migration
main();

