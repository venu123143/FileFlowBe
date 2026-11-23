import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import fs from 'fs';
import { open as openFile } from 'fs/promises';
import path from 'path';

// Set ffmpeg and ffprobe paths
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}
if (ffprobeStatic) {
  ffmpeg.setFfprobePath(ffprobeStatic.path);
}

export interface AudioTrackInfo {
  index: number;
  codec: string;
  language: string;
  title: string;
  channels: number | null;
  sampleRate: number | null;
  bitrate: number | null;
  isDefault: boolean;
  isForced: boolean;
}

export interface VideoMetadata {
  duration: number | null;
  videoCodec: string | null;
  resolution: string | null;
  bitrate: number | null;
  width: number | null;
  height: number | null;
  frameRate: string | null;
  audioTracks: AudioTrackInfo[];
  subtitleTracks: SubtitleTrackInfo[];
  format: string | null;
  formatLongName: string | null;
  size: number | null;
}

export interface SubtitleTrackInfo {
  index: number;
  codec: string;
  language: string;
  title: string;
  isDefault: boolean;
  isForced: boolean;
}

/**
 * Extract metadata from a video file using ffprobe
 * @param filePath - Local file path or URL (presigned S3 URL)
 * @returns Video metadata including audio tracks, duration, resolution, etc.
 */
export const extractVideoMetadata = async (filePath: string): Promise<VideoMetadata> => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        console.error('[VideoProcessor] ffprobe error:', err);
        return reject(err);
      }

      try {
        const format = metadata.format;
        const streams = metadata.streams || [];

        // Video stream info
        const videoStream = streams.find(s => s.codec_type === 'video');
        const audioStreams = streams.filter(s => s.codec_type === 'audio');
        const subtitleStreams = streams.filter(s => s.codec_type === 'subtitle');

        // Parse frame rate
        let frameRate: string | null = null;
        if (videoStream?.r_frame_rate) {
          const parts = videoStream.r_frame_rate.split('/');
          const num = parseFloat(parts[0] ?? '0');
          const den = parseFloat(parts[1] ?? '1');
          if (den > 0) frameRate = (num / den).toFixed(2);
        }

        // Extract audio tracks
        const audioTracks: AudioTrackInfo[] = audioStreams.map((stream, idx) => ({
          index: stream.index ?? idx,
          codec: stream.codec_name ?? 'unknown',
          language: stream.tags?.language ?? 'und',
          title: stream.tags?.title ?? stream.tags?.handler_name ?? `Audio Track ${idx + 1}`,
          channels: stream.channels ?? null,
          sampleRate: stream.sample_rate ? parseInt(String(stream.sample_rate)) : null,
          bitrate: stream.bit_rate ? parseInt(String(stream.bit_rate)) : null,
          isDefault: stream.disposition?.default === 1,
          isForced: stream.disposition?.forced === 1,
        }));

        // Extract subtitle tracks
        const subtitleTracks: SubtitleTrackInfo[] = subtitleStreams.map((stream, idx) => ({
          index: stream.index ?? idx,
          codec: stream.codec_name ?? 'unknown',
          language: stream.tags?.language ?? 'und',
          title: stream.tags?.title ?? `Subtitle Track ${idx + 1}`,
          isDefault: stream.disposition?.default === 1,
          isForced: stream.disposition?.forced === 1,
        }));

        const result: VideoMetadata = {
          duration: format.duration ? parseFloat(String(format.duration)) : null,
          videoCodec: videoStream?.codec_name ?? null,
          resolution: videoStream?.width && videoStream?.height
            ? `${videoStream.width}x${videoStream.height}`
            : null,
          bitrate: format.bit_rate ? parseInt(String(format.bit_rate)) : null,
          width: videoStream?.width ?? null,
          height: videoStream?.height ?? null,
          frameRate,
          audioTracks,
          subtitleTracks,
          format: format.format_name ?? null,
          formatLongName: format.format_long_name ?? null,
          size: format.size ? parseInt(String(format.size)) : null,
        };

        console.log('[VideoProcessor] Extracted metadata:', {
          duration: result.duration,
          resolution: result.resolution,
          videoCodec: result.videoCodec,
          audioTracksCount: result.audioTracks.length,
          subtitleTracksCount: result.subtitleTracks.length,
        });

        resolve(result);
      } catch (parseErr) {
        console.error('[VideoProcessor] Metadata parse error:', parseErr);
        reject(parseErr);
      }
    });
  });
};

/**
 * Generate a thumbnail from video at specified timestamp
 * @param inputPath - Input video file path or URL
 * @param outputPath - Local path to save thumbnail
 * @param timestamp - Time in seconds (default: 10% of duration or 5s)
 * @param width - Thumbnail width (default: 320)
 * @returns Path to generated thumbnail
 */
export const generateThumbnail = async (
  inputPath: string,
  outputPath: string,
  timestamp?: number,
  width: number = 320
): Promise<string> => {
  return new Promise((resolve, reject) => {
    let command = ffmpeg(inputPath)
      .outputOptions([
        '-vframes 1',
        `-vf scale=${width}:-1`,
        '-f image2',
        '-update 1',
      ])
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (err) => {
        console.error('[VideoProcessor] Thumbnail generation error:', err);
        reject(err);
      });

    if (timestamp !== undefined) {
      command = command.seekInput(timestamp);
    }

    command.run();
  });
};

/**
 * Generate multiple thumbnails at different timestamps
 */
export const generateThumbnails = async (
  inputPath: string,
  outputDir: string,
  count: number = 10,
  width: number = 320
): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const outputPattern = path.join(outputDir, 'thumb_%03d.jpg');
    
    ffmpeg(inputPath)
      .outputOptions([
        '-vf', `fps=1/${Math.max(1, Math.floor(60 / count))},scale=${width}:-1`,
        '-vsync vfr',
        '-f image2',
      ])
      .output(outputPattern)
      .on('end', () => {
        // Read generated files
        const files = fs.readdirSync(outputDir)
          .filter((f: string) => f.startsWith('thumb_') && f.endsWith('.jpg'))
          .sort()
          .map((f: string) => path.join(outputDir, f));
        resolve(files);
      })
      .on('error', (err) => {
        console.error('[VideoProcessor] Thumbnails generation error:', err);
        reject(err);
      })
      .run();
  });
};

/**
 * Convert audio track info to VideoPlayer AudioTrackOption format
 */
export const convertToAudioTrackOptions = (audioTracks: AudioTrackInfo[]): Array<{
  id: string;
  language: string;
  label: string;
  kind: 'main' | 'commentary' | 'dub' | 'description' | 'alternative';
  default: boolean;
}> => {
  return audioTracks.map((track, idx) => ({
    id: `audio_${track.index}`,
    language: track.language,
    label: track.title,
    kind: track.isDefault ? 'main' : 'alternative',
    default: track.isDefault || idx === 0,
  }));
};

/**
 * Apply MP4 Fast Start optimization by moving the moov atom to the beginning.
 * This allows browsers to start playback immediately without downloading the
 * entire file first. Uses `-c copy` so there is no re-encoding — fast and lossless.
 * @param inputPath - Input video file path
 * @param outputPath - Output video file path (can be same as input if using temp file)
 * @returns Path to the optimized file
 */
export const applyFastStart = async (
  inputPath: string,
  outputPath: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions(['-c', 'copy', '-movflags', '+faststart'])
      .output(outputPath)
      .on('end', () => {
        console.log('[VideoProcessor] Fast Start applied:', { inputPath, outputPath });
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('[VideoProcessor] Fast Start error:', err);
        reject(err);
      })
      .run();
  });
};

const MAX_MP4_TOP_LEVEL_BOXES = 1024;

interface Mp4BoxHeader {
  type: string;
  size: number;
  headerSize: number;
}

/**
 * Parse a 4-byte ASCII MP4 box header (plus optional 8-byte extended size).
 */
function parseMp4BoxHeader(buf: Buffer, bytesRead: number, remainingBytes: number): Mp4BoxHeader | null {
  if (bytesRead < 8) return null;

  const size32 = buf.readUInt32BE(0);
  // Ensure box type is printable ASCII (e.g. 'ftyp', 'moov', 'mdat')
  for (let i = 4; i < 8; i++) {
    const byte = buf[i]!;
    if (byte < 0x20 || byte > 0x7e) return null;
  }
  const type = buf.toString('ascii', 4, 8);

  if (size32 === 0) {
    return { type, size: remainingBytes, headerSize: 8 };
  }

  if (size32 === 1) {
    if (bytesRead < 16) return null;
    const size64 = Number(buf.readBigUInt64BE(8));
    if (!Number.isSafeInteger(size64) || size64 < 16) return null;
    return { type, size: size64, headerSize: 16 };
  }

  if (size32 < 8) return null;
  return { type, size: size32, headerSize: 8 };
}

/**
 * Walk top-level MP4 boxes to determine whether `moov` appears before `mdat`.
 */
async function walkMp4BoxesForFastStart(
  totalSize: number,
  readHeaderAt: (offset: number) => Promise<Buffer | null>
): Promise<boolean> {
  if (totalSize < 8) return false;

  let offset = 0;
  let seenMoov = false;

  for (let i = 0; i < MAX_MP4_TOP_LEVEL_BOXES && offset + 8 <= totalSize; i++) {
    const buf = await readHeaderAt(offset);
    if (!buf) return false;

    const header = parseMp4BoxHeader(buf, buf.length, totalSize - offset);
    if (!header || offset + header.size > totalSize) {
      return false;
    }

    if (header.type === 'mdat') {
      // If mdat appears before moov, fast start is not enabled;
      // if moov was already seen, both exist in fast-start order.
      return seenMoov;
    }

    if (header.type === 'moov') {
      seenMoov = true;
    }

    offset += header.size;
  }

  return false;
}

/**
 * Check if an MP4 file already has the moov atom before mdat (fast start)
 * by parsing top-level ISO BMFF box headers directly (no subprocesses).
 * Supports both local file paths and HTTP(S) URLs (via Range requests).
 * Returns true only if both `moov` and `mdat` exist and `moov` precedes `mdat`.
 * @param filePathOrUrl - Local path or HTTP(S) URL to the MP4 file
 */
export const hasFastStart = async (filePathOrUrl: string): Promise<boolean> => {
  if (/^https?:\/\//i.test(filePathOrUrl)) {
    let totalSize: number | null = null;

    const readRemoteHeaderAt = async (offset: number): Promise<Buffer | null> => {
      const response = await fetch(filePathOrUrl, {
        headers: { Range: `bytes=${offset}-${offset + 15}` },
        signal: AbortSignal.timeout(10000),
      });

      // Must be 206 Partial Content; abort immediately if server ignores Range
      if (response.status !== 206) {
        await response.body?.cancel();
        return null;
      }

      const contentRange = response.headers.get('content-range');
      if (totalSize === null && contentRange) {
        const match = contentRange.match(/\/(\d+)$/);
        if (match?.[1]) {
          totalSize = parseInt(match[1], 10);
        }
      }

      const arrayBuf = await response.arrayBuffer();
      return Buffer.from(arrayBuf);
    };

    try {
      const firstHeader = await readRemoteHeaderAt(0);
      if (!firstHeader || totalSize === null) return false;

      return await walkMp4BoxesForFastStart(totalSize, async (offset) =>
        offset === 0 ? firstHeader : readRemoteHeaderAt(offset)
      );
    } catch {
      return false;
    }
  }

  let handle: Awaited<ReturnType<typeof openFile>> | null = null;
  try {
    handle = await openFile(filePathOrUrl, 'r');
    const fileStat = await handle.stat();
    const headerBuf = Buffer.alloc(16);

    return await walkMp4BoxesForFastStart(fileStat.size, async (offset) => {
      const { bytesRead } = await handle!.read(headerBuf, 0, 16, offset);
      return bytesRead >= 8 ? headerBuf.subarray(0, bytesRead) : null;
    });
  } catch {
    return false;
  } finally {
    await handle?.close().catch(() => {});
  }
};

export default {
  extractVideoMetadata,
  generateThumbnail,
  generateThumbnails,
  convertToAudioTrackOptions,
  applyFastStart,
  hasFastStart,
};