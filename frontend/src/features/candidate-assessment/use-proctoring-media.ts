'use client';

import { useEffect, useRef } from 'react';
import type { CaptureStatusValue } from './context';

const DEFAULT_TIMESLICE = 6000; // smaller chunks → smaller uploads

/** Prefer WebM (vp8/vp9). Use MP4 only if WebM is not supported. */
function getSupportedMimeType(includeAudio: boolean = true): string {
  const webmCandidates = includeAudio
    ? ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm']
    : ['video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm'];
  const mp4Candidates = includeAudio
    ? ['video/mp4;codecs=h264,aac', 'video/mp4']
    : ['video/mp4;codecs=h264', 'video/mp4'];

  const isSupported = (t: string) =>
    typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t);

  for (const t of webmCandidates) if (isSupported(t)) { console.log('[MediaRecorder] MIME:', t); return t; }
  for (const t of mp4Candidates) if (isSupported(t)) { console.log('[MediaRecorder] MIME (mp4 fallback):', t); return t; }

  console.warn('[MediaRecorder] No explicit MIME supported; letting browser choose');
  return '';
}

type QueueItem = {
  blob: Blob;
  sequence: number;
  durationMs: number;
  attempts: number;
  type: 'webcam' | 'screen';
};

/** POST a single segment using FormData (binary). Throws an Error with status/body on HTTP failure. */
async function transmitSegmentFormData(args: {
  token: string;
  assessmentId: string;
  blob: Blob;
  sequence: number;
  durationMs: number;
  type: 'webcam' | 'screen';
}) {
  const { token, assessmentId, blob, sequence, durationMs, type } = args;
  const ext = blob.type.includes('webm') ? 'webm' : blob.type.includes('mp4') ? 'mp4' : 'bin';

  const form = new FormData();
  form.append('file', blob, `seg-${type}-${sequence}.${ext}`);
  form.append('assessmentId', assessmentId);
  form.append('mediaType', type);
  form.append('sequence', String(sequence));
  form.append('durationMs', String(durationMs));
  form.append('mimeType', blob.type || 'video/webm');

  // ⚠️ Ensure this endpoint exists (app/api/candidate/proctoring/media/route.ts)
  const res = await fetch('/api/candidate/proctoring/media', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }, // don't set Content-Type with FormData
    body: form,
  });

  if (!res.ok) {
    let body = '';
    try { body = await res.text(); } catch {}
    const err = new Error(`Upload failed: ${res.status} ${res.statusText}`);
    (err as any).status = res.status;
    (err as any).statusText = res.statusText;
    (err as any).body = body;
    (err as any).url = res.url;
    throw err;
  }
}

export interface UseProctoringMediaOptions {
  enabled: boolean;
  token: string | undefined;
  assessmentId: string | undefined;
  chunkDurationMs?: number;
  onError?: (channel: 'webcam' | 'screen', error: Error) => void;
  includeScreen?: boolean;
  onScreenReady?: () => void;
  onScreenDenied?: (error: Error) => void;
  onScreenEnded?: () => void;
  onWebcamStatusChange?: (status: CaptureStatusValue) => void;
  onScreenStatusChange?: (status: CaptureStatusValue) => void;
  onPendingChange?: (pending: number) => void;
  onUploadSuccess?: (channel: 'webcam' | 'screen', timestamp: string) => void;
  restartToken?: number;
}

export function useProctoringMediaStreams({
  enabled,
  token,
  assessmentId,
  chunkDurationMs = DEFAULT_TIMESLICE,
  onError,
  includeScreen = false,
  onScreenReady,
  onScreenDenied,
  onScreenEnded,
  onWebcamStatusChange,
  onScreenStatusChange,
  onPendingChange,
  onUploadSuccess,
  restartToken = 0,
}: UseProctoringMediaOptions) {
  const webcamRecorderRef = useRef<MediaRecorder | null>(null);
  const screenRecorderRef = useRef<MediaRecorder | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const webcamSequenceRef = useRef(0);
  const screenSequenceRef = useRef(0);
  const queueRef = useRef<{ webcam: QueueItem[]; screen: QueueItem[] }>({ webcam: [], screen: [] });
  const flushingRef = useRef<{ webcam: boolean; screen: boolean }>({ webcam: false, screen: false });
  const flushTimerRef = useRef<{ webcam: number | null; screen: number | null }>({ webcam: null, screen: null });

  // callback refs to avoid re-subscribing
  const onErrorRef = useRef(onError);
  const onScreenReadyRef = useRef(onScreenReady);
  const onScreenDeniedRef = useRef(onScreenDenied);
  const onScreenEndedRef = useRef(onScreenEnded);
  const onWebcamStatusChangeRef = useRef(onWebcamStatusChange);
  const onScreenStatusChangeRef = useRef(onScreenStatusChange);
  const onPendingChangeRef = useRef(onPendingChange);
  const onUploadSuccessRef = useRef(onUploadSuccess);

  useEffect(() => {
    onErrorRef.current = onError;
    onScreenReadyRef.current = onScreenReady;
    onScreenDeniedRef.current = onScreenDenied;
    onScreenEndedRef.current = onScreenEnded;
    onWebcamStatusChangeRef.current = onWebcamStatusChange;
    onScreenStatusChangeRef.current = onScreenStatusChange;
    onPendingChangeRef.current = onPendingChange;
    onUploadSuccessRef.current = onUploadSuccess;
  });

  useEffect(() => {
    const clearTimers = () => {
      (Object.keys(flushTimerRef.current) as Array<keyof typeof flushTimerRef.current>).forEach((ch) => {
        const t = flushTimerRef.current[ch];
        if (t) { window.clearTimeout(t); flushTimerRef.current[ch] = null; }
      });
    };

    const updatePending = () => {
      const total = queueRef.current.webcam.length + queueRef.current.screen.length;
      onPendingChangeRef.current?.(total);
    };

    const scheduleFlush = (channel: 'webcam' | 'screen', delay = 0) => {
      if (flushTimerRef.current[channel] != null) return;
      flushTimerRef.current[channel] = window.setTimeout(() => {
        flushTimerRef.current[channel] = null;
        void flush(channel);
      }, delay);
    };

    const flush = async (channel: 'webcam' | 'screen') => {
      if (flushingRef.current[channel]) return;
      const queue = queueRef.current[channel];
      if (queue.length === 0) { updatePending(); return; }

      flushingRef.current[channel] = true;
      const item = queue[0];

      try {
        await transmitSegmentFormData({
          token: token as string,
          assessmentId: assessmentId as string,
          blob: item.blob,
          sequence: item.sequence,
          durationMs: item.durationMs,
          type: item.type,
        });

        queue.shift();
        updatePending();
        onUploadSuccessRef.current?.(channel, new Date().toISOString());

        flushingRef.current[channel] = false;
        scheduleFlush(channel, 0);
      } catch (error: any) {
        item.attempts += 1;
        const delay = Math.min(16000, 1000 * Math.pow(2, item.attempts - 1));

        // Log the raw error and contextual info
        console.error('[Proctoring] Upload failed (raw):', error);
        console.error('[Proctoring] Upload failed (context):', {
          channel,
          sequence: item.sequence,
          size: item.blob?.size,
          mime: item.blob?.type,
          status: error?.status,
          statusText: error?.statusText,
          body: typeof error?.body === 'string' ? error.body.slice(0, 300) : undefined,
          url: error?.url,
          message: error?.message,
        });

        onErrorRef.current?.(channel, error instanceof Error ? error : new Error('Failed to upload media segment'));

        flushingRef.current[channel] = false;
        scheduleFlush(channel, delay);
      }
    };

    const stopRecorder = (rec: MediaRecorder | null) => {
      if (!rec) return;
      try {
        if (rec.state !== 'inactive') {
          try { rec.requestData?.(); } catch {}
          rec.stop();
        }
      } catch {}
    };

    const cleanupStream = (stream: MediaStream | null) => {
      if (!stream) return;
      stream.getTracks().forEach((track) => { try { track.stop(); } catch {} });
    };

    // ---- Guard: not ready to start
    if (!enabled || !token || !assessmentId) {
      stopRecorder(webcamRecorderRef.current); webcamRecorderRef.current = null;
      stopRecorder(screenRecorderRef.current); screenRecorderRef.current = null;

      cleanupStream(webcamStreamRef.current); webcamStreamRef.current = null;
      cleanupStream(screenStreamRef.current); screenStreamRef.current = null;

      webcamSequenceRef.current = 0;
      screenSequenceRef.current = 0;
      queueRef.current = { webcam: [], screen: [] };
      flushingRef.current = { webcam: false, screen: false };
      clearTimers();
      updatePending();
      onWebcamStatusChangeRef.current?.('idle');
      onScreenStatusChangeRef.current?.('idle');
      return;
    }

    let cancelled = false;

    const setup = async () => {
      try {
        // Webcam + mic
        const webcamStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) { cleanupStream(webcamStream); return; }
        onWebcamStatusChangeRef.current?.('active');
        webcamStreamRef.current = webcamStream;

        const webcamMime = getSupportedMimeType(true);
        const webcamRecorder = new MediaRecorder(webcamStream, {
          ...(webcamMime && { mimeType: webcamMime }),
          videoBitsPerSecond: 800_000, // tuned down
        });
        webcamRecorderRef.current = webcamRecorder;
        webcamSequenceRef.current = 0;

        webcamRecorder.ondataavailable = (evt) => {
          if (!evt.data || evt.data.size === 0) {
            console.warn('[Proctoring] Empty webcam chunk – skipped');
            return;
          }
          if (evt.data.size < 1000) {
            console.warn('[Proctoring] Tiny webcam chunk:', evt.data.size, 'bytes');
          }
          const seq = webcamSequenceRef.current++;
          queueRef.current.webcam.push({
            blob: evt.data,
            sequence: seq,
            durationMs: chunkDurationMs,
            attempts: 0,
            type: 'webcam',
          });
          updatePending();
          scheduleFlush('webcam');
        };

        webcamRecorder.onerror = (e: any) => {
          const err = e?.error ?? new Error('MediaRecorder error (webcam)');
          onWebcamStatusChangeRef.current?.('error');
          onErrorRef.current?.('webcam', err instanceof Error ? err : new Error(String(err)));
        };

        webcamRecorder.start(chunkDurationMs);

        // Optional screen
        if (includeScreen) {
          try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
              video: {
                displaySurface: 'monitor',
                frameRate: { ideal: 30 },
              },
              audio: false,
            });
            if (cancelled) { cleanupStream(screenStream); return; }

            screenStreamRef.current = screenStream;
            const screenMime = getSupportedMimeType(false);
            const screenRecorder = new MediaRecorder(screenStream, {
              ...(screenMime && { mimeType: screenMime }),
              videoBitsPerSecond: 1_500_000,
            });
            screenRecorderRef.current = screenRecorder;
            screenSequenceRef.current = 0;
            onScreenStatusChangeRef.current?.('active');

            const screenTrack = screenStream.getVideoTracks()[0];
            if (screenTrack) {
              screenTrack.addEventListener('ended', () => {
                onScreenEndedRef.current?.();
                // stop to flush last chunk
                stopRecorder(screenRecorderRef.current);
              });
            }

            screenRecorder.ondataavailable = (evt) => {
              if (!evt.data || evt.data.size === 0) {
                console.warn('[Proctoring] Empty screen chunk – skipped');
                return;
              }
              if (evt.data.size < 1000) {
                console.warn('[Proctoring] Tiny screen chunk:', evt.data.size, 'bytes');
              }
              const seq = screenSequenceRef.current++;
              queueRef.current.screen.push({
                blob: evt.data,
                sequence: seq,
                durationMs: chunkDurationMs,
                attempts: 0,
                type: 'screen',
              });
              updatePending();
              scheduleFlush('screen');
            };

            screenRecorder.onerror = (e: any) => {
              const err = e?.error ?? new Error('MediaRecorder error (screen)');
              onScreenStatusChangeRef.current?.('error');
              onErrorRef.current?.('screen', err instanceof Error ? err : new Error(String(err)));
            };

            screenRecorder.start(chunkDurationMs);
            onScreenReadyRef.current?.();
          } catch (screenError: any) {
            const err = screenError instanceof Error ? screenError : new Error('Screen sharing was blocked');
            console.error('[Proctoring] Screen share error:', err.message);
            onScreenStatusChangeRef.current?.('error');
            onScreenDeniedRef.current?.(err);
            onErrorRef.current?.('screen', err);
          }
        }
      } catch (e: any) {
        const err = e instanceof Error ? e : new Error('Unable to start webcam capture');
        onWebcamStatusChangeRef.current?.('error');
        onErrorRef.current?.('webcam', err);
      }
    };

    void setup();

    // Cleanup: stop recorders (flush last chunks), stop tracks, attempt final flushes
    return () => {
      cancelled = true;

      const wr = webcamRecorderRef.current;
      const sr = screenRecorderRef.current;
      if (wr && wr.state !== 'inactive') { try { wr.requestData?.(); } catch {} }
      if (sr && sr.state !== 'inactive') { try { sr.requestData?.(); } catch {} }

      const stopRecorder = (rec: MediaRecorder | null) => {
        if (!rec) return;
        try {
          if (rec.state !== 'inactive') rec.stop();
        } catch {}
      };
      stopRecorder(webcamRecorderRef.current); webcamRecorderRef.current = null;
      stopRecorder(screenRecorderRef.current); screenRecorderRef.current = null;

      const cleanupStream = (s: MediaStream | null) => {
        if (!s) return;
        s.getTracks().forEach((t) => { try { t.stop(); } catch {} });
      };
      cleanupStream(webcamStreamRef.current); webcamStreamRef.current = null;
      cleanupStream(screenStreamRef.current); screenStreamRef.current = null;

      // try to flush remaining items immediately
      if (queueRef.current.webcam.length) scheduleFlush('webcam', 0);
      if (queueRef.current.screen.length) scheduleFlush('screen', 0);

      onWebcamStatusChangeRef.current?.('idle');
      onScreenStatusChangeRef.current?.('idle');
      // We intentionally do not clear queues here to avoid data loss;
      // retries will continue briefly if the page stays open.
    };
  }, [enabled, token, assessmentId, chunkDurationMs, includeScreen, restartToken]);
}
