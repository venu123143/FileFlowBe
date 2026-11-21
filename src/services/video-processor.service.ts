import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { pathToFileURL } from 'url';
import { fileURLToPath } from 'url';
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
        const fs = require('fs');
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

export default {
  extractVideoMetadata,
  generateThumbnail,
  generateThumbnails,
  convertToAudioTrackOptions,
};