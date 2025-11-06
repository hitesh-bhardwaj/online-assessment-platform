import fs from 'fs/promises';
import path from 'path';

import { getLocalMediaRoot } from './storage';

export interface CleanupOptions {
  retentionMinutes?: number;
  dryRun?: boolean;
  logger?: (message: string) => void;
}

export interface CleanupStats {
  filesExamined: number;
  filesPruned: number;
  bytesFreed: number;
  directoriesRemoved: number;
}

const defaultRetention = () => Number(process.env.PROCTORING_MEDIA_RETENTION_MINUTES ?? '120');

const log = (logger: CleanupOptions['logger'], message: string) => {
  logger?.(`[proctoring-cleanup] ${message}`);
};

const dirExists = async (target: string) => {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
};

export async function cleanupLocalProctoringMedia(options: CleanupOptions = {}): Promise<CleanupStats> {
  const { retentionMinutes = defaultRetention(), dryRun = true, logger } = options;
  const stats: CleanupStats = {
    filesExamined: 0,
    filesPruned: 0,
    bytesFreed: 0,
    directoriesRemoved: 0,
  };

  const mediaRoot = getLocalMediaRoot();

  if (!(await dirExists(mediaRoot))) {
    log(logger, `media directory not found, skipping (${mediaRoot})`);
    return stats;
  }

  const cutoff = Date.now() - retentionMinutes * 60 * 1000;
  const resultDirs = await fs.readdir(mediaRoot, { withFileTypes: true });

  for (const entry of resultDirs) {
    if (!entry.isDirectory()) continue;

    const resultDir = path.join(mediaRoot, entry.name);
    const files = await fs.readdir(resultDir, { withFileTypes: true });

    let remainingFiles = files.length;

    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith('.webm')) continue;

      const filePath = path.join(resultDir, file.name);
      const stat = await fs.stat(filePath);
      stats.filesExamined += 1;

      if (stat.mtimeMs < cutoff) {
        if (dryRun) {
          log(logger, `would remove ${filePath}`);
        } else {
          await fs.unlink(filePath);
          log(logger, `removed ${filePath}`);
        }

        stats.filesPruned += 1;
        stats.bytesFreed += stat.size;
        remainingFiles -= 1;
      }
    }

    if (remainingFiles === 0) {
      if (dryRun) {
        log(logger, `would remove empty directory ${resultDir}`);
      } else {
        await fs.rmdir(resultDir).catch(() => undefined);
        log(logger, `removed empty directory ${resultDir}`);
      }
      stats.directoriesRemoved += 1;
    }
  }

  log(
    logger,
    `scanned ${resultDirs.length} folders; pruned ${stats.filesPruned} file(s); freed ${(stats.bytesFreed / (1024 * 1024)).toFixed(2)} MB`
  );

  return stats;
}
