import path from "path"
import s3Service from "@/config/s3.config"
import { type IFileInfo } from "@/models/File.model"

export interface IFile {
    filename: string
    mimetype: string
    buffer: Buffer<ArrayBuffer>
    size: number
    originalName: string
}

const processFile = async (file: File): Promise<IFileInfo> => {
    // Bun/Hono File => get ArrayBuffer
    const fileExtension = path.extname(file.name)
    const basename = path.basename(file.name, fileExtension).replace(/ /g, '_')
    const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1e9)
    const finalName = `${basename}_${uniqueSuffix}${fileExtension}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const s3File: IFile = {
        filename: finalName,
        mimetype: file.type,
        buffer: buffer,
        size: buffer.length,
        originalName: file.name,
    }
    // Upload to S3
    const uploadFileName = await s3Service.uploadFile(s3File)

    return {
        file_size: buffer.length,
        file_type: file.type,
        storage_path: uploadFileName,
    }
}

export default {
    processFile,
}
