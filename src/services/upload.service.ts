import fs from "fs"
import path from "path"
import s3Service from "@/config/s3.config"

interface FileResult {
    fileName: string
    url: string
}

export interface IFile {
    filename: string
    mimetype: string
    buffer: Buffer<ArrayBuffer>
    size: number
    originalName: string
}

const deleteLocalFile = async (filePath: string) => {
    try {
        await fs.promises.unlink(filePath)
    } catch (err) {
        console.error(`Error deleting local file ${filePath}:`, err)
    }
}
// const uploadDir = path.join(process.cwd(), "src/public/images")

const processFile = async (file: File): Promise<FileResult> => {
    // Bun/Hono File => get ArrayBuffer
    const fileExtension = path.extname(file.name)
    const basename = path.basename(file.name, fileExtension).replace(/ /g, '_')
    const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1e9)
    const finalName = `${basename}_${uniqueSuffix}${fileExtension}`
    const buffer = Buffer.from(await file.arrayBuffer())

    // const filePath = path.join(uploadDir, finalName) // already saved by middleware
    // const buffer = await fs.readFileSync(filePath)
    const s3File: IFile = {
        filename: finalName,
        mimetype: file.type,
        buffer: buffer,
        size: buffer.length,
        originalName: file.name,
    }
    // Upload to S3
    const uploadFileName = await s3Service.uploadFile(s3File)
    const fileUrl = await s3Service.getFileUrl(uploadFileName)

    // Clean up local files
    // await deleteLocalFile(finalName)

    return {
        fileName: uploadFileName,
        url: fileUrl,
    }
}

export default {
    processFile,
}
