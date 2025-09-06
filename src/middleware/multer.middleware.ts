import type { Context, Next } from 'hono'

// Allowed mime types (same as your multerFilter)
const allowedMimeTypes = [
    'image/jpg',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/heic',
    'image/heif'
]

// Ensure directory exists
// const createIfNoExist = async (dirPath: string) => {
//     try {
//         await fs.mkdir(dirPath, { recursive: true })
//     } catch (err) {
//         console.error('Failed to create dir', err)
//         throw err
//     }
// }

// Middleware for file upload validation
export const uploadImageMiddleware = async (c: Context, next: Next) => {
    const formData = await c.req.formData()
    const files = formData.getAll('files') as File[] // expects <input type="file" name="files" multiple />

    if (files.length === 0) {
        return c.json({ message: 'No file uploaded' }, 400)
    }

    if (files.length > 5) {
        return c.json({ message: 'The maximum number of files allowed is 5.' }, 400)
    }


    for (const file of files) {
        if (!allowedMimeTypes.includes(file.type)) {
            return c.json({ message: `Unsupported file format: ${file.type}` }, 400)
        }

        if (file.size > 12 * 1000 * 1000) {
            return c.json({ message: 'File exceeds 12 MB limit. Please reduce file size and retry.' }, 400)
        }
        const allowedFormats = [
            "image/jpg",
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/heic",
            "image/heif"
            // "video/mp4",
        ]

        const invalidFiles = files.filter((file) => !allowedFormats.includes(file.type))
        if (invalidFiles.length > 0) {
            return c.json({ message: "Unsupported file format detected" }, 400)
        }
    }

    // Move on to next route handler
    await next()
}
