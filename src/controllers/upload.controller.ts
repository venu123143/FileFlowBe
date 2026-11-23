import { type Context } from "hono"
import res from "@/utils/response"
import uploadService from "@/services/upload.service"
import s3Service from "@/config/s3.config"
import videoProcessor from "@/services/video-processor.service"
import type { IUserAttributes } from "@/models/User.model"
import { NotificationType, type IFileInfo } from "@/models"
import { addToNotificationQueue } from "@/core/notification-queue"
import { addToAnalyticsQueue, AnalyticsEventType } from "@/core/analytics-queue"
import { addCacheWarmJob } from "@/repository/cache.repository"
import { CacheJobType } from "@/types/cache.types"
import { canUserAccessStoragePaths } from "@/utils/file-access"

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
        if (user?.id) {
            addToNotificationQueue({
                user_id: user.id,
                type: NotificationType.FILE_UPLOAD_COMPLETED,
                title: "File(s) uploaded",
                message: `File(s) have been uploaded successfully`,
                is_read: false,
                created_at: new Date(),
                data: { results },
                related_user_id: user.id,
            })

            // Track upload analytics for each file
            files.forEach((file, index) => {
                const result = results[index];
                if (result) {
                    addToAnalyticsQueue({
                        userId: user.id,
                        eventType: AnalyticsEventType.FILE_UPLOADED,
                        metadata: {
                            fileName: file.name,
                            fileSize: result.file_size,
                            fileType: result.file_type,
                            isFolder: false
                        }
                    });
                }
            });

            // Queue cache warming for video files (public videos only)
            const videoKeys = results
                .filter(r => r.file_type?.startsWith('video/'))
                .map(r => r.storage_path);

            if (videoKeys.length > 0) {
                try {
                    await addCacheWarmJob(videoKeys, CacheJobType.WARM, user?.id, 3);
                    console.log('[Upload] Cache warming jobs queued for:', videoKeys);
                } catch (warmErr) {
                    console.warn('[Upload] Failed to queue cache warming jobs:', warmErr);
                }
            }
        }
        return res.SuccessResponse(c, 200, {
            message: "File(s) uploaded successfully",
            data: results,
        })

    } catch (error: any) {
        return res.FailureResponse(c, 500, { message: "Internal server error", error: error.message })
    }
}

const deleteFile = async (c: Context) => {
    const user = c.get("user") as IUserAttributes
    try {
        const validatedParams = c.get('validatedParams') as { fileName: string }
        const { fileName } = validatedParams

        const canDelete = await canUserAccessStoragePaths(user, [fileName], 'write')
        if (!canDelete) {
            return res.FailureResponse(c, 403, { message: "Forbidden: you do not have permission to delete this file" })
        }

        await s3Service.deleteFile(fileName)
        if (user?.id) {
            addToNotificationQueue({
                user_id: user.id,
                type: NotificationType.FILE_DELETED,
                title: "File deleted",
                message: `File ${fileName} has been deleted`,
                is_read: false,
                created_at: new Date(),
                data: {},
                related_user_id: user.id,
            })
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
    const user = c.get("user") as IUserAttributes
    try {
        const validatedParams = c.get('validatedQuery') as {
            fileName: string
            download?: boolean
            downloadName?: string
        }
        const { fileName, download, downloadName } = validatedParams

        const canRead = await canUserAccessStoragePaths(user, [fileName], 'read')
        if (!canRead) {
            return res.FailureResponse(c, 403, { message: "Forbidden: you do not have permission to access this file" })
        }

        const resolvedDownloadName = download
            ? (downloadName || fileName.split('/').pop() || 'download')
            : undefined;
        const url = await s3Service.getFileUrl(fileName, 3600, resolvedDownloadName)
        if (!url) {
            return res.FailureResponse(c, 404, { message: "File not found" })
        }

        if (download && user?.id) {
            addToAnalyticsQueue({
                userId: user.id,
                eventType: AnalyticsEventType.FILE_DOWNLOADED,
                metadata: {
                    fileName: resolvedDownloadName || fileName,
                    storagePath: fileName,
                },
            });
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

        // Base file info
        const result: IFileInfo = {
            file_size: metadata.contentLength || 0,
            file_type: metadata.contentType || '',
            storage_path: key
        }

        // Extract video metadata for video files
        let videoMetadata = null;
        let audioTrackOptions = null;

        if (metadata.contentType?.startsWith('video/')) {
            try {
                // Get presigned URL for video processing (valid for 1 hour)
                const presignedUrl = await s3Service.getFileUrl(key, 3600);

                // Extract video metadata including audio tracks
                videoMetadata = await videoProcessor.extractVideoMetadata(presignedUrl);

                // Add duration to result
                if (videoMetadata.duration) {
                    result.duration = Math.round(videoMetadata.duration);
                }

                // Convert audio tracks to frontend format
                if (videoMetadata.audioTracks.length > 0) {
                    audioTrackOptions = videoProcessor.convertToAudioTrackOptions(videoMetadata.audioTracks);
                    // Store audio tracks in metadata for database
                    result.audio_tracks = videoMetadata.audioTracks;
                }
                console.log('[Upload] Video metadata extracted:', {
                    duration: videoMetadata.duration,
                    audioTracks: videoMetadata.audioTracks.length,
                    resolution: videoMetadata.resolution,
                });
            } catch (videoErr) {
                console.warn('[Upload] Video metadata extraction failed:', videoErr);
                // Don't fail the upload if metadata extraction fails
            }
        }

        if (user?.id) {
            const fileName = key.split('/').pop() || 'Unknown file'
            addToNotificationQueue({
                user_id: user.id,
                type: NotificationType.MULTIPART_UPLOAD_COMPLETED,
                title: "Multipart upload completed",
                message: `Multipart upload has been completed successfully`,
                is_read: false,
                created_at: new Date(),
                data: { ...result, fileName },
                related_user_id: user.id,
            })
        }

        // Queue cache warming for video files (public videos only)
        if (metadata.contentType?.startsWith('video/')) {
            await addCacheWarmJob([key], CacheJobType.WARM, user?.id, 3);
        }

        // Return enhanced response with video metadata
        const responseData = {
            ...result,
            ...(videoMetadata && {
                duration: result.duration,
                audio_tracks: audioTrackOptions,
                video_codec: videoMetadata.videoCodec,
                resolution: videoMetadata.resolution,
                video_bitrate: videoMetadata.bitrate,
            }),
        };

        return res.SuccessResponse(c, 200, {
            message: "Upload completed successfully",
            data: responseData
        })
    } catch (error: any) {
        if (user?.id) {
            const fileName = key.split('/').pop() || 'Unknown file'
            addToNotificationQueue({
                user_id: user.id,
                type: NotificationType.MULTIPART_UPLOAD_FAILED,
                title: "Multipart upload failed",
                message: `Multipart upload has been failed`,
                is_read: false,
                created_at: new Date(),
                data: { fileName },
                related_user_id: user.id,
            })
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
            addToNotificationQueue({
                user_id: user.id,
                type: NotificationType.MULTIPART_UPLOAD_FAILED,
                title: "Multipart upload aborted",
                message: `Multipart upload has been aborted`,
                is_read: false,
                created_at: new Date(),
                data: { fileName },
                related_user_id: user.id,
            })
        }
        return res.SuccessResponse(c, 200, {
            message: "Upload aborted successfully",
            data: [],
        })
    } catch (error: any) {
        if (user?.id) {
            const fileName = key.split('/').pop() || 'Unknown file'
            addToNotificationQueue({
                user_id: user.id,
                type: NotificationType.MULTIPART_UPLOAD_FAILED,
                title: "Multipart upload failed",
                message: `Multipart upload has been failed`,
                is_read: false,
                created_at: new Date(),
                data: { fileName },
                related_user_id: user.id,
            })
        }
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

const getAllFiles = async (c: Context) => {
    try {
        const validatedQuery = c.get('validatedQuery') as {
            folder?: string;
            maxKeys?: number;
            continuationToken?: string
        };
        const { folder, maxKeys = 100, continuationToken } = validatedQuery || {};

        const result = await s3Service.getAllFiles(folder, maxKeys, continuationToken);
        return res.SuccessResponse(c, 200, {
            message: "All files retrieved successfully",
            data: {
                files: result.files,
                pagination: {
                    hasMore: result.isTruncated,
                    nextContinuationToken: result.nextContinuationToken || null,
                    maxKeys: maxKeys,
                    currentCount: result.files.length
                }
            },
        })
    } catch (error: any) {
        console.log("error", error);
        return res.FailureResponse(c, 500, {
            message: "Failed to get all files",
            error: error.message,
        })
    }
}

export default {
    getAllFiles,
    getPartsByUploadKey,
    initiateUpload,
    uploadFile,
    uploadChunk,
    completeUpload,
    abortUpload,
    deleteFile,
    getFiles,
}
