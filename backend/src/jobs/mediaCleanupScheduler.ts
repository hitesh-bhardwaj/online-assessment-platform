import { cleanupLocalProctoringMedia } from '../utils/mediaCleanup';

const parseMinutes = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

let intervalHandle: NodeJS.Timeout | null = null;
let running = false;

export const scheduleProctoringMediaCleanup = () => {
  const enabled = process.env.ENABLE_PROCTORING_CLEANUP !== 'false';

  if (!enabled) {
    console.log('[proctoring-cleanup] scheduled cleanup disabled via ENABLE_PROCTORING_CLEANUP');
    return;
  }

  const intervalMinutes = parseMinutes(process.env.PROCTORING_CLEANUP_INTERVAL_MINUTES, 60);
  const retentionMinutes = parseMinutes(process.env.PROCTORING_MEDIA_RETENTION_MINUTES, 120);
  const dryRun = process.env.PROCTORING_MEDIA_CLEANUP_DRY_RUN === 'true';

  const runCleanup = async () => {
    if (running) {
      console.log('[proctoring-cleanup] previous run still in progress, skipping');
      return;
    }

    running = true;
    try {
      await cleanupLocalProctoringMedia({
        retentionMinutes,
        dryRun,
        logger: (message) => console.log(message),
      });
    } catch (error) {
      console.error('[proctoring-cleanup] error during cleanup', error);
    } finally {
      running = false;
    }
  };

  runCleanup();

  intervalHandle = setInterval(runCleanup, intervalMinutes * 60 * 1000);
  console.log(
    `[proctoring-cleanup] scheduled every ${intervalMinutes} minute(s) (retention=${retentionMinutes} min, dryRun=${dryRun})`
  );
};

export const stopProctoringMediaCleanup = () => {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
};
