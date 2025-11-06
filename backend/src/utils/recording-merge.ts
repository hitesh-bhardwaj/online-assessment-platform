import 'dotenv/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import AssessmentResult from '../models/AssessmentResult';
import { uploadMergedRecording } from './storage';

const execAsync = promisify(exec);

interface MergeResult {
  type: 'webcam' | 'screen';
  segmentCount: number;
  outputPath: string;
  outputSize: number;
  r2Url?: string;
  r2Key?: string;
}

/**
 * Merge recording chunks for a specific type (webcam or screen)
 */
async function mergeChunks(
  resultId: string,
  type: 'webcam' | 'screen',
  segments: any[],
  baseDir: string
): Promise<MergeResult | null> {
  if (segments.length === 0) {
    console.log(`[RecordingMerge] No ${type} segments to merge for ${resultId}`);
    return null;
  }

  console.log(`[RecordingMerge] Merging ${segments.length} ${type} segments for ${resultId}...`);

  // Sort by sequence to ensure correct order
  const sortedSegments = segments
    .filter((s) => s.filePath && s.sequence !== undefined)
    .sort((a, b) => a.sequence - b.sequence);

  if (sortedSegments.length === 0) {
    console.log(`[RecordingMerge] No ${type} segments with valid sequence numbers for ${resultId}`);
    return null;
  }

  // Output file
  const outputFileName = `${type}-merged.webm`;
  const outputPath = path.join(baseDir, outputFileName);

  try {
    // Step 1: Binary concatenation (MediaRecorder chunks 2+ don't have WebM headers)
    const chunks: Buffer[] = [];

    for (const segment of sortedSegments) {
      const chunkData = await fs.readFile(segment.filePath);
      chunks.push(chunkData);
    }

    const mergedBuffer = Buffer.concat(chunks);

    // Step 2: Write concatenated file
    const concatenatedPath = path.join(baseDir, `${type}-concatenated.webm`);
    await fs.writeFile(concatenatedPath, mergedBuffer);
    console.log(`[RecordingMerge] Concatenated ${type} file: ${(mergedBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    // Step 3: Re-encode with ffmpeg to fix timestamps
    // Using -cpu-used 4 for faster encoding (vs 0 which is slowest/highest quality)
    // This reduces merge time from 2-5 min to 30-60 seconds for 60min video
    const command =
      type === 'screen'
        ? `ffmpeg -fflags +genpts -i "${concatenatedPath}" -c:v libvpx -b:v 2000k -crf 23 -cpu-used 4 -deadline realtime "${outputPath}" -y`
        : `ffmpeg -fflags +genpts -i "${concatenatedPath}" -c:v libvpx -c:a libopus -b:v 1200k -b:a 96k -crf 23 -cpu-used 4 -deadline realtime "${outputPath}" -y`;

    await execAsync(command, { maxBuffer: 1024 * 1024 * 10 });

    // Clean up concatenated file
    await fs.unlink(concatenatedPath);

    // Check output file
    const stats = await fs.stat(outputPath);
    console.log(`[RecordingMerge] Merged ${type}: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

    // Verify with ffprobe
    try {
      const { stdout: durationStr } = await execAsync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${outputPath}"`
      );
      const duration = parseFloat(durationStr.trim());
      if (!isNaN(duration)) {
        console.log(`[RecordingMerge] Duration: ${duration.toFixed(2)} seconds`);
      }
    } catch {
      // Duration verification failed, but file might still be valid
    }

    // Step 4: Upload to R2 if available
    const r2Result = await uploadMergedRecording(resultId, type, outputPath);

    if (r2Result) {
      console.log(`[RecordingMerge] Uploaded ${type} to R2: ${r2Result.publicUrl}`);

      // Delete local merged file after successful R2 upload to save space
      try {
        await fs.unlink(outputPath);
        console.log(`[RecordingMerge] Deleted local merged file (saved to R2)`);
      } catch (unlinkError) {
        console.warn(`[RecordingMerge] Could not delete local merged file:`, unlinkError);
      }
    } else {
      console.log(`[RecordingMerge] R2 upload skipped, keeping local file`);
    }

    return {
      type,
      segmentCount: sortedSegments.length,
      outputPath,
      outputSize: stats.size,
      r2Url: r2Result?.publicUrl,
      r2Key: r2Result?.fileKey,
    };
  } catch (error) {
    console.error(`[RecordingMerge] Failed to merge ${type}:`, error);

    // Clean up on error
    try {
      await fs.unlink(outputPath).catch(() => {});
    } catch {}

    return null;
  }
}

/**
 * Merge all recordings for an assessment result
 * This function runs asynchronously in the background
 */
export async function mergeRecordingsForResult(resultId: string): Promise<void> {
  console.log(`[RecordingMerge] Starting merge for result: ${resultId}`);

  try {
    const result = await AssessmentResult.findById(resultId);

    if (!result) {
      console.log(`[RecordingMerge] Result not found: ${resultId}`);
      return;
    }

    if (!result.proctoringReport || !result.proctoringReport.mediaSegments) {
      console.log(`[RecordingMerge] No media segments found for ${resultId}`);
      return;
    }

    const segments = result.proctoringReport.mediaSegments;
    const webcamSegments = segments.filter((s) => s.type === 'webcam' && s.storage === 'local');
    const screenSegments = segments.filter((s) => s.type === 'screen' && s.storage === 'local');

    console.log(`[RecordingMerge] Found ${webcamSegments.length} webcam + ${screenSegments.length} screen segments`);

    if (webcamSegments.length === 0 && screenSegments.length === 0) {
      console.log(`[RecordingMerge] No local segments to merge for ${resultId}`);
      return;
    }

    // Determine base directory from first segment
    const firstSegment = segments.find((s) => s.filePath);
    if (!firstSegment || !firstSegment.filePath) {
      console.log(`[RecordingMerge] No file paths found in segments for ${resultId}`);
      return;
    }

    const baseDir = path.dirname(firstSegment.filePath);

    // Merge webcam chunks
    const webcamResult = await mergeChunks(resultId, 'webcam', webcamSegments, baseDir);

    // Merge screen chunks
    const screenResult = await mergeChunks(resultId, 'screen', screenSegments, baseDir);

    // Update database with merged file URLs (prefer R2, fallback to local)
    if (webcamResult || screenResult) {
      console.log(`[RecordingMerge] Updating database for ${resultId}...`);

      if (webcamResult) {
        if (!result.proctoringReport.recordingUrls) {
          result.proctoringReport.recordingUrls = {};
        }
        // Use R2 URL if available, otherwise use local path
        result.proctoringReport.recordingUrls.webcam = webcamResult.r2Url || webcamResult.outputPath;
      }

      if (screenResult) {
        if (!result.proctoringReport.recordingUrls) {
          result.proctoringReport.recordingUrls = {};
        }
        // Use R2 URL if available, otherwise use local path
        result.proctoringReport.recordingUrls.screen = screenResult.r2Url || screenResult.outputPath;
      }

      result.markModified('proctoringReport');
      await result.save();

      console.log(`[RecordingMerge] ✅ Merge complete for ${resultId}!`);
      if (webcamResult) {
        console.log(`  Webcam: ${webcamResult.segmentCount} chunks → ${(webcamResult.outputSize / 1024 / 1024).toFixed(2)} MB`);
      }
      if (screenResult) {
        console.log(`  Screen: ${screenResult.segmentCount} chunks → ${(screenResult.outputSize / 1024 / 1024).toFixed(2)} MB`);
      }
    }

    // Optionally delete individual chunks to save space
    if (process.env.DELETE_CHUNKS_AFTER_MERGE === 'true') {
      console.log(`[RecordingMerge] Deleting individual chunks for ${resultId}...`);

      for (const segment of segments) {
        if (segment.filePath && segment.storage === 'local') {
          try {
            await fs.unlink(segment.filePath);
          } catch (error) {
            // Ignore errors (file might already be deleted)
          }
        }
      }

      console.log(`[RecordingMerge] Chunks deleted for ${resultId}`);
    }
  } catch (error) {
    console.error(`[RecordingMerge] ❌ Error processing result ${resultId}:`, error);
  }
}

/**
 * Start merging recordings in the background (fire and forget)
 * This doesn't block the response to the user
 */
export function startRecordingMergeJob(resultId: string): void {
  console.log(`[RecordingMerge] Queuing merge job for result: ${resultId}`);

  // Run merge in background without blocking
  mergeRecordingsForResult(resultId).catch((error) => {
    console.error(`[RecordingMerge] Background merge job failed for ${resultId}:`, error);
  });
}
