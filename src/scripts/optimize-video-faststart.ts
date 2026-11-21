import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import type { ReadableStream as WebReadableStream } from 'stream/web';
import s3Service, { FolderNameEnum } from '@/config/s3.config';
import { applyFastStart, hasFastStart } from '@/services/video-processor.service';
import cacheService from '@/services/cache.service';

/**
 * Script to optimize existing video files in S3/Hetzner with MP4 Fast Start (+faststart)
 * and refresh the Cloudflare CDN cache.
 *
 * Usage:
 *   bun run src/scripts/optimize-video-faststart.ts <video-key-or-filename>
 *   Example:
 *   bun run src/scripts/optimize-video-faststart.ts videos/savageroomxsuperchatlivecomhls23e038c4mp4
 */

const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

function normalizeVideoKey(input: string): string {
    let key = input.trim();
    if (/^https?:\/\//i.test(key)) {
        key = new URL(key).pathname;
    }
    key = key.replace(/^\/+/, '');
    return key.includes('/') ? key : `${FolderNameEnum.VIDEOS}/${key}`;
}

async function optimizeVideo(videoKey: string) {
    const fullKey = normalizeVideoKey(videoKey);
    console.log(`\n🎬 Optimizing video: ${fullKey}`);

    const tmpDir = os.tmpdir();
    const uniqueId = Date.now();
    const inputPath = path.join(tmpDir, `input_${uniqueId}.mp4`);
    const outputPath = path.join(tmpDir, `optimized_${uniqueId}.mp4`);

    try {
        console.log('1. Checking file existence and metadata...');
        const metadata = await s3Service.getMetadata(fullKey);
        if (!metadata || !metadata.contentLength) {
            throw new Error(`File ${fullKey} not found in storage.`);
        }
        console.log(`   Size: ${(metadata.contentLength / (1024 * 1024)).toFixed(2)} MB`);
        console.log(`   Content-Type: ${metadata.contentType || '(unset)'}, Cache-Control: ${metadata.cacheControl || '(unset)'}`);

        const presignedUrl = await s3Service.getFileUrl(fullKey, 3600);

        console.log('2. Checking Fast Start via HTTP Range headers...');
        let alreadyFast = await hasFastStart(presignedUrl);

        if (alreadyFast) {
            console.log('   ⚡ Video already has moov atom before mdat (Fast Start enabled)!');
            if (metadata.cacheControl !== IMMUTABLE_CACHE_CONTROL) {
                console.log('   🏷️  Updating S3 Cache-Control metadata in place (no re-upload needed)...');
                await s3Service.updateObjectCacheControl(fullKey, IMMUTABLE_CACHE_CONTROL, metadata.contentType);
                console.log(`   ✅ Metadata updated with CacheControl: ${IMMUTABLE_CACHE_CONTROL}`);
            } else {
                console.log('   ✅ Cache-Control already set; skipping S3 upload.');
            }
        } else {
            console.log('3. Downloading video from S3...');
            const res = await fetch(presignedUrl);
            if (!res.ok || !res.body) {
                throw new Error(`Failed to download: HTTP ${res.status}`);
            }

            const fileStream = fs.createWriteStream(inputPath);
            await pipeline(Readable.fromWeb(res.body as unknown as WebReadableStream), fileStream);
            console.log('   Downloaded to temp file.');

            // Double-check locally in case Range probe was inconclusive
            alreadyFast = await hasFastStart(inputPath);
            if (alreadyFast) {
                console.log('   ⚡ Local check confirms Fast Start is already enabled.');
                if (metadata.cacheControl !== IMMUTABLE_CACHE_CONTROL) {
                    await s3Service.updateObjectCacheControl(fullKey, IMMUTABLE_CACHE_CONTROL, metadata.contentType);
                    console.log(`   ✅ Metadata updated with CacheControl: ${IMMUTABLE_CACHE_CONTROL}`);
                }
            } else {
                console.log('4. Applying MP4 Fast Start (-c copy -movflags +faststart)...');
                await applyFastStart(inputPath, outputPath);
                console.log('   ✅ Fast Start applied successfully without re-encoding.');

                const targetStat = fs.statSync(outputPath);
                console.log('5. Re-uploading optimized file to S3 with immutable Cache-Control...');
                const readStream = fs.createReadStream(outputPath);
                const slashIdx = fullKey.indexOf('/');
                const folder = (slashIdx > 0 ? fullKey.slice(0, slashIdx) : FolderNameEnum.VIDEOS) as FolderNameEnum;
                const objectSubKey = slashIdx > 0 ? fullKey.slice(slashIdx + 1) : fullKey;
                const fileName = path.posix.basename(fullKey);
                const mimeType = metadata.contentType || 'video/mp4';

                await s3Service.uploadStream(
                    objectSubKey,
                    readStream,
                    fileName,
                    mimeType,
                    targetStat.size,
                    folder,
                    IMMUTABLE_CACHE_CONTROL
                );
                console.log(`   ✅ Uploaded to S3 with CacheControl: ${IMMUTABLE_CACHE_CONTROL}`);
            }
        }

        console.log('6. Purging and warming Cloudflare CDN cache...');
        const refreshResult = await cacheService.refreshVideo(fullKey);
        if (refreshResult.error) {
            console.log(`   ⚠️  Cache refresh failed: ${refreshResult.error} (${refreshResult.durationMs}ms)`);
        } else {
            console.log(`   ✅ Cache refreshed: ${refreshResult.status} (${refreshResult.durationMs}ms, status: ${refreshResult.cacheStatus})`);
        }

        console.log('\n🎉 Finished! Video is now optimized for instant startup streaming.');
    } finally {
        // Cleanup temp files
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    }
}

async function main() {
    const videoKey = process.argv[2];
    if (!videoKey) {
        console.error('Usage: bun run src/scripts/optimize-video-faststart.ts <video-key>');
        process.exit(1);
    }

    try {
        await optimizeVideo(videoKey);
    } catch (err: any) {
        console.error('❌ Optimization failed:', err.message);
        process.exit(1);
    }
}

main();
