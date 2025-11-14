import 'dotenv/config';
import mongoose from 'mongoose';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import AssessmentResult from '../models/AssessmentResult';
import { uploadMergedRecording } from '../utils/storage';

const execAsync = promisify(exec);
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGODB_ATLAS_URI || 'mongodb://localhost:27017/oap';

interface MergeResult {
  type: 'webcam' | 'screen';
  segmentCount: number;
  outputPath: string;
  outputSize: number;
  r2Url?: string;
  r2Key?: string;
}

async function mergeChunks(resultId: string, type: 'webcam' | 'screen', segments: any[], baseDir: string): Promise<MergeResult | null> {
  if (segments.length === 0) {
    console.log(`  No ${type} segments to merge`);
    return null;
  }

  console.log(`  Merging ${segments.length} ${type} segments...`);

  // Sort by sequence to ensure correct order
  const sortedSegments = segments
    .filter(s => s.filePath && s.sequence !== undefined)
    .sort((a, b) => a.sequence - b.sequence);

  if (sortedSegments.length === 0) {
    console.log(`  No ${type} segments with valid sequence numbers`);
    return null;
  }

  // Output file
  const outputFileName = `${type}-merged.webm`;
  const outputPath = path.join(baseDir, outputFileName);

  try {
    console.log(`  Merging ${sortedSegments.length} chunks...`);

    // Step 1: Binary concatenation (MediaRecorder chunks 2+ don't have WebM headers)
    console.log(`  Step 1: Concatenating binary data...`);
    const chunks: Buffer[] = [];

    for (const segment of sortedSegments) {
      const chunkData = await fs.readFile(segment.filePath);
      chunks.push(chunkData);
      console.log(`    Read chunk ${segment.sequence}: ${(chunkData.length / 1024).toFixed(2)} KB`);
    }

    const mergedBuffer = Buffer.concat(chunks);

    // Step 2: Write concatenated file
    const concatenatedPath = path.join(baseDir, `${type}-concatenated.webm`);
    await fs.writeFile(concatenatedPath, mergedBuffer);
    console.log(`  Step 2: Wrote concatenated file: ${(mergedBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    // Step 3: Re-encode with ffmpeg to fix timestamps
    console.log(`  Step 3: Re-encoding with ffmpeg (fast preset)...`);

    // Using optimized settings for faster merge:
    // -cpu-used 4: Fast encoding (vs 0 = slowest/best quality)
    // -crf 23: Good quality (vs 10 = best quality)
    // -deadline realtime: Faster processing
    const command = type === 'screen'
      ? `ffmpeg -fflags +genpts -i "${concatenatedPath}" -c:v libvpx -b:v 2000k -crf 23 -cpu-used 4 -deadline realtime "${outputPath}" -y`
      : `ffmpeg -fflags +genpts -i "${concatenatedPath}" -c:v libvpx -c:a libopus -b:v 1200k -b:a 96k -crf 23 -cpu-used 4 -deadline realtime "${outputPath}" -y`;

    const { stdout, stderr } = await execAsync(command, { maxBuffer: 1024 * 1024 * 10 });

    // Clean up concatenated file
    await fs.unlink(concatenatedPath);

    // Check output file
    const stats = await fs.stat(outputPath);
    console.log(`  ✅ Merged ${type}: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

    // Verify with ffprobe
    try {
      const { stdout: durationStr } = await execAsync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${outputPath}"`);
      const duration = parseFloat(durationStr.trim());
      if (!isNaN(duration)) {
        console.log(`  ✅ Duration: ${duration.toFixed(2)} seconds`);
      }
    } catch {
      console.log(`  ⚠️  Could not verify duration`);
    }

    // Upload to R2 if available
    console.log(`  Step 4: Uploading to R2...`);
    const r2Result = await uploadMergedRecording(resultId, type, outputPath);

    if (r2Result) {
      console.log(`  ✅ Uploaded to R2: ${r2Result.publicUrl}`);

      // Delete local merged file after successful R2 upload to save space
      try {
        await fs.unlink(outputPath);
        console.log(`  🗑️  Deleted local merged file (saved to R2)`);
      } catch (unlinkError) {
        console.warn(`  ⚠️  Could not delete local merged file:`, unlinkError);
      }
    } else {
      console.log(`  ⚠️  R2 upload skipped (not configured or failed), keeping local file`);
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
    console.error(`  ❌ Failed to merge ${type}:`, error);

    // Clean up on error
    try {
      await fs.unlink(outputPath).catch(() => {});
    } catch {}

    return null;
  }
}

export async function mergeRecordingsForResult(resultId: string) {
  try {
    const result = await AssessmentResult.findById(resultId);

    if (!result) {
      console.log(`❌ Result not found: ${resultId}`);
      throw new Error(`Result not found: ${resultId}`);
    }

    console.log(`\n📹 Processing Result: ${resultId}`);
    console.log(`Status: ${result.status}`);

    if (!result.proctoringReport || !result.proctoringReport.mediaSegments) {
      console.log(`❌ No media segments found`);
      return;
    }

    const segments = result.proctoringReport.mediaSegments;
    const webcamSegments = segments.filter(s => s.type === 'webcam' && s.storage === 'local');
    const screenSegments = segments.filter(s => s.type === 'screen' && s.storage === 'local');

    console.log(`Found ${webcamSegments.length} webcam + ${screenSegments.length} screen segments`);

    // Initialize merge status
    if (!result.proctoringReport.mergeStatus) {
      result.proctoringReport.mergeStatus = {};
    }

    // Set status to processing
    if (webcamSegments.length > 0) {
      result.proctoringReport.mergeStatus.webcam = 'processing';
    }
    if (screenSegments.length > 0) {
      result.proctoringReport.mergeStatus.screen = 'processing';
    }
    result.proctoringReport.mergeStatus.lastAttempt = new Date();
    result.markModified('proctoringReport');
    await result.save();

    if (webcamSegments.length === 0 && screenSegments.length === 0) {
      console.log(`❌ No local segments to merge`);
      return;
    }

    // Determine base directory from first segment
    const firstSegment = segments.find(s => s.filePath);
    if (!firstSegment || !firstSegment.filePath) {
      console.log(`❌ No file paths found in segments`);
      return;
    }

    const baseDir = path.dirname(firstSegment.filePath);

    // Merge webcam chunks
    const webcamResult = await mergeChunks(resultId, 'webcam', webcamSegments, baseDir);

    // Merge screen chunks
    const screenResult = await mergeChunks(resultId, 'screen', screenSegments, baseDir);

    // Update database with merged file URLs (prefer R2, fallback to local)
    if (webcamResult || screenResult) {
      console.log(`\n📝 Updating database...`);

      if (webcamResult) {
        if (!result.proctoringReport.recordingUrls) {
          result.proctoringReport.recordingUrls = {};
        }
        // Use R2 URL if available, otherwise use local path
        result.proctoringReport.recordingUrls.webcam = webcamResult.r2Url || webcamResult.outputPath;
        // Update merge status to completed
        if (result.proctoringReport.mergeStatus) {
          result.proctoringReport.mergeStatus.webcam = 'completed';
        }
        console.log(`  Webcam URL: ${webcamResult.r2Url ? 'R2' : 'Local'} - ${result.proctoringReport.recordingUrls.webcam}`);
      }

      if (screenResult) {
        if (!result.proctoringReport.recordingUrls) {
          result.proctoringReport.recordingUrls = {};
        }
        // Use R2 URL if available, otherwise use local path
        result.proctoringReport.recordingUrls.screen = screenResult.r2Url || screenResult.outputPath;
        // Update merge status to completed
        if (result.proctoringReport.mergeStatus) {
          result.proctoringReport.mergeStatus.screen = 'completed';
        }
        console.log(`  Screen URL: ${screenResult.r2Url ? 'R2' : 'Local'} - ${result.proctoringReport.recordingUrls.screen}`);
      }

      result.markModified('proctoringReport');
      await result.save();

      console.log(`✅ Database updated with merged recordings`);
    }

    // Optionally delete individual chunks to save space
    if (process.env.DELETE_CHUNKS_AFTER_MERGE === 'true') {
      console.log(`\n🗑️  Deleting individual chunks...`);

      for (const segment of segments) {
        if (segment.filePath && segment.storage === 'local') {
          try {
            await fs.unlink(segment.filePath);
          } catch (error) {
            // Ignore errors (file might already be deleted)
          }
        }
      }

      console.log(`✅ Chunks deleted`);
    }

    console.log(`\n🎉 Merge complete!`);

    if (webcamResult) {
      console.log(`  Webcam: ${webcamResult.segmentCount} chunks → ${(webcamResult.outputSize / 1024 / 1024).toFixed(2)} MB`);
    }

    if (screenResult) {
      console.log(`  Screen: ${screenResult.segmentCount} chunks → ${(screenResult.outputSize / 1024 / 1024).toFixed(2)} MB`);
    }

  } catch (error) {
    console.error(`❌ Error processing result ${resultId}:`, error);

    // Update merge status to failed
    try {
      const result = await AssessmentResult.findById(resultId);
      if (result && result.proctoringReport) {
        if (!result.proctoringReport.mergeStatus) {
          result.proctoringReport.mergeStatus = {};
        }

        // Mark failed status for types that were being processed
        const segments = result.proctoringReport.mediaSegments || [];
        const hasWebcam = segments.some(s => s.type === 'webcam' && s.storage === 'local');
        const hasScreen = segments.some(s => s.type === 'screen' && s.storage === 'local');

        if (hasWebcam) {
          result.proctoringReport.mergeStatus.webcam = 'failed';
        }
        if (hasScreen) {
          result.proctoringReport.mergeStatus.screen = 'failed';
        }

        result.proctoringReport.mergeStatus.lastAttempt = new Date();
        result.proctoringReport.mergeStatus.error = error instanceof Error ? error.message : String(error);

        result.markModified('proctoringReport');
        await result.save();
      }
    } catch (updateError) {
      console.error(`Failed to update merge status:`, updateError);
    }

    throw error; // Re-throw for queue retry logic
  }
}

async function main() {
  try {
    console.log('🔧 Recording Chunk Merger');
    console.log('=========================\n');

    // Check if ffmpeg is available
    try {
      await execAsync('ffmpeg -version');
      console.log('✅ ffmpeg is available\n');
    } catch {
      console.error('❌ ffmpeg is not installed!');
      console.error('\nInstall ffmpeg:');
      console.error('  macOS: brew install ffmpeg');
      console.error('  Ubuntu: sudo apt install ffmpeg');
      console.error('  Windows: choco install ffmpeg\n');
      process.exit(1);
    }

    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get result ID from command line or find latest
    const resultId = process.argv[2];

    if (resultId) {
      // Merge specific result
      await mergeRecordingsForResult(resultId);
    } else {
      // Find latest result with media segments
      const results = await AssessmentResult.find({
        'proctoringReport.mediaSegments.0': { $exists: true }
      })
        .sort({ startedAt: -1 })
        .limit(5)
        .select('_id status startedAt proctoringReport.mediaSegments');

      if (results.length === 0) {
        console.log('❌ No results with media segments found');
        await mongoose.disconnect();
        return;
      }

      console.log(`Found ${results.length} recent result(s) with media:\n`);

      results.forEach((r, i) => {
        const segCount = r.proctoringReport?.mediaSegments?.length || 0;
        console.log(`${i + 1}. ${r._id} - ${segCount} segments - ${r.status} - ${r.startedAt}`);
      });

      console.log(`\nMerging chunks for latest result: ${results[0]._id}\n`);
      await mergeRecordingsForResult(results[0]._id.toString());
    }

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');

  } catch (error) {
    console.error('❌ Fatal error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Only run main() if this script is executed directly, not when imported as a module
if (require.main === module) {
  main();
}
