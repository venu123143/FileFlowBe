import { type Context } from "hono"
import res from "@/utils/response"
import uploadService from "@/services/upload.service"
import s3Service from "@/config/s3.config"
import type { IUserAttributes } from "@/models/User.model"
import type { IFileInfo } from "@/models"
import notificationService from "@/services/notification.service"

const uploadFile = async (c: Context) => {
    const user = c.get("user") as IUserAttributes
    if (!user?.id) {
        return res.FailureResponse(c, 400, { message: "User not found" })
    }
    try {

        const formData = await c.req.formData()
        const files = formData.getAll("files") as File[]

        if (!files || files.length === 0) {
            return res.FailureResponse(c, 400, { message: "No files uploaded" })
        }

        const results = await Promise.all(files.map((file) => uploadService.processFile(file)))
        return res.SuccessResponse(c, 200, {
            message: "File(s) uploaded successfully",
            data: results,
        })
    } catch (error: any) {
        return res.FailureResponse(c, 500, { message: "Internal server error" })
    }
}

const deleteFile = async (c: Context) => {
    const user = c.get("user") as IUserAttributes
    try {
        const validatedParams = c.get('validatedParams') as { fileName: string }
        const { fileName } = validatedParams

        await s3Service.deleteFile(fileName)
        if (user?.id) {
            await notificationService.createFileDeletedNotification(user.id, fileName)
        }
        return res.SuccessResponse(c, 200, {
            message: "File deleted successfully",
            data: {},
        })
    } catch {
        return res.FailureResponse(c, 500, { message: "Internal server error" })
    }
}

const getFiles = async (c: Context) => {
    try {
        const validatedParams = c.get('validatedParams') as { fileName: string }
        const { fileName } = validatedParams

        const url = await s3Service.getFileUrl(fileName)
        if (!url) {
            return res.FailureResponse(c, 404, { message: "File not found" })
        }

        return res.SuccessResponse(c, 200, {
            message: "File fetched successfully",
            data: { url },
        })
    } catch {
        return res.FailureResponse(c, 500, { message: "File not found" })
    }
}

const initiateUpload = async (c: Context) => {
    try {
        const validated = c.get('validated') as { fileName: string; mimeType: string }
        const { fileName, mimeType } = validated

        const { uploadId, key } = await s3Service.initiateMultipartUpload(fileName, mimeType)
        if (!uploadId || !key) {
            return res.FailureResponse(c, 500, { message: "Failed to initiate upload" })
        }

        return res.SuccessResponse(c, 200, {
            message: "Upload initiated successfully",
            data: { uploadId, key },
        })
    } catch (error: any) {
        return res.FailureResponse(c, 500, {
            message: "Failed to initiate upload",
            error: error.message,
        })
    }
}

const uploadChunk = async (c: Context) => {
    const validatedParams = c.get('validatedParams') as { uploadId: string }
    const { uploadId } = validatedParams

    try {
        const formData = await c.req.formData()
        const key = formData.get("key") as string
        const metadataRaw = formData.get("metadata") as string
        const chunk = formData.get("chunk") as File

        if (!key || !metadataRaw || !chunk) {
            return res.FailureResponse(c, 400, { message: "Missing required form data: key, metadata, or chunk" })
        }

        const metadata = JSON.parse(metadataRaw)
        const buffer = Buffer.from(await chunk.arrayBuffer())
        const { ETag, PartNumber } = await s3Service.uploadChunk(uploadId, key, buffer, metadata)

        return res.SuccessResponse(c, 200, {
            message: "Chunk uploaded successfully",
            data: { ETag, PartNumber },
        })
    } catch (error: any) {
        return res.FailureResponse(c, 500, {
            message: "Failed to upload chunk",
            error: error.message,
            uploadId,
        })
    }
}

const completeUpload = async (c: Context) => {
    const user = c.get("user") as IUserAttributes
    const validatedParams = c.get('validatedParams') as { uploadId: string }
    const validated = c.get('validated') as { key: string; parts: any[] }
    const { uploadId } = validatedParams
    const { key, parts } = validated

    try {
        await s3Service.completeMultipartUpload(uploadId, key, parts);
        const metadata = await s3Service.getMetadata(key);

        const result: IFileInfo = {
            file_size: metadata.contentLength || 0,
            file_type: metadata.contentType || '',
            storage_path: key
        }
        if (user?.id) {
            const fileName = key.split('/').pop() || 'Unknown file'
            await notificationService.createFileUploadSuccessNotification(user.id, { ...result, fileName }, 'multipart')
        }

        return res.SuccessResponse(c, 200, {
            message: "Upload completed successfully",
            data: result
        })
    } catch (error: any) {
        if (user?.id) {
            const fileName = key.split('/').pop() || 'Unknown file'
            await notificationService.createFileUploadFailureNotification(user.id, fileName, error.message || 'Failed to complete multipart upload', 'multipart')
        }
        return res.FailureResponse(c, 500, {
            message: "Failed to complete upload",
            error: error.message,
        })
    }
}

const abortUpload = async (c: Context) => {
    const user = c.get("user") as IUserAttributes
    const validatedParams = c.get('validatedParams') as { uploadId: string }
    const validated = c.get('validated') as { key: string }
    const { uploadId } = validatedParams
    const { key } = validated

    try {
        await s3Service.abortMultipartUpload(uploadId, key)

        if (user?.id) {
            const fileName = key.split('/').pop() || 'Unknown file'
            await notificationService.createFileUploadFailureNotification(
                user.id,
                fileName,
                'Upload was cancelled by user',
                'multipart'
            )
        }
        return res.SuccessResponse(c, 200, {
            message: "Upload aborted successfully",
            data: [],
        })
    } catch (error: any) {
        return res.FailureResponse(c, 500, {
            message: "Failed to abort upload",
            error: error.message,
        })
    }
}

const getPartsByUploadKey = async (c: Context) => {
    const validatedParams = c.get('validatedParams') as { uploadId: string }
    const validatedQuery = c.get('validatedQuery') as { key: string }
    const { uploadId } = validatedParams
    const { key } = validatedQuery

    try {
        const parts = await s3Service.getUploadedParts(uploadId, key)
        return res.SuccessResponse(c, 200, {
            message: "Parts retrieved successfully",
            data: parts,
        })
    } catch (error: any) {
        return res.FailureResponse(c, 500, {
            message: "Failed to list parts",
            error: error.message,
            uploadId,
        })
    }
}

export default {
    getPartsByUploadKey,
    initiateUpload,
    uploadFile,
    uploadChunk,
    completeUpload,
    abortUpload,
    deleteFile,
    getFiles,
}
