import { type Context } from "hono"
import res from "@/utils/response"
import uploadService from "@/services/upload.service"
import s3Service from "@/config/s3.config"
import type { IUserAttributes } from "@/models/User.model"

const uploadFile = async (c: Context) => {
    try {
        const user = c.get("user") as IUserAttributes
        if (!user?.id) {
            return res.FailureResponse(c, 400, { message: "User not found" })
        }

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
    } catch (error) {
        return res.FailureResponse(c, 500, { message: "Internal server error" })
    }
}

const deleteFile = async (c: Context) => {
    try {
        const { fileName } = c.req.param()
        await s3Service.deleteFile(fileName as string)

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
        const { fileName } = c.req.param()
        const url = await s3Service.getFileUrl(fileName as string)
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
        const body = await c.req.json<{ fileName: string; mimeType: string }>()
        const { fileName, mimeType } = body

        if (!fileName || !mimeType) {
            return res.FailureResponse(c, 400, { message: "Missing required parameters" })
        }

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
    const { uploadId } = c.req.param()
    try {
        const formData = await c.req.formData()
        const key = formData.get("key") as string
        const metadataRaw = formData.get("metadata") as string
        const chunk = formData.get("chunk") as File

        if (!uploadId || !key || !metadataRaw || !chunk) {
            return res.FailureResponse(c, 400, { message: "Missing required parameters" })
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
    const { uploadId } = c.req.param()
    const body = await c.req.json<{ key: string; parts: any[] }>()
    const { key, parts } = body

    if (!uploadId || !key || !parts) {
        return res.FailureResponse(c, 400, { message: "Missing required parameters" })
    }

    try {
        await s3Service.completeMultipartUpload(uploadId, key, parts)
        const fileURL = await s3Service.getFileUrl(key)

        return res.SuccessResponse(c, 200, {
            message: "Upload completed successfully",
            data: { location: fileURL },
        })
    } catch (error: any) {
        return res.FailureResponse(c, 500, {
            message: "Failed to complete upload",
            error: error.message,
        })
    }
}

const abortUpload = async (c: Context) => {
    const { uploadId } = c.req.param()
    const body = await c.req.json<{ key: string }>()
    const { key } = body

    if (!uploadId || !key) {
        return res.FailureResponse(c, 400, { message: "Missing required parameters" })
    }

    try {
        await s3Service.abortMultipartUpload(uploadId, key)
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
    const { uploadId } = c.req.param()
    const { key } = c.req.query()

    if (!key) {
        return res.FailureResponse(c, 400, { message: "Missing file key." })
    }

    try {
        const parts = await s3Service.getUploadedParts(uploadId as string, key)
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
