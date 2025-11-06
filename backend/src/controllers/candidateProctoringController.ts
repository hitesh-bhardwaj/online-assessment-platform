import { randomUUID } from 'crypto';
import { Response } from 'express';
import mongoose from 'mongoose';

import { AuthenticatedRequest } from '../middleware/auth';
import { AssessmentResult } from '../models';
import { storeProctoringSegment } from '../utils/storage';

const defaultSummary = 'Proctoring events recorded. Detailed analysis forthcoming.';
const MAX_MEDIA_SEGMENTS = 24;
const MAX_PROCTORING_EVENTS = 120;
const severityRank: Record<string, number> = { low: 0, medium: 1, high: 2 };
const severityImpact: Record<string, number> = { low: 2, medium: 7, high: 15 };

const toObjectId = (value: string) => new mongoose.Types.ObjectId(value);

const ensureProctoringReport = (result: any) => {
  if (!result.proctoringReport) {
    result.proctoringReport = {
      events: [],
      trustScore: 100,
      riskLevel: 'low',
      summary: defaultSummary,
      recordingUrls: {},
      mediaSegments: []
    };
    return;
  }

  result.proctoringReport.events = Array.isArray(result.proctoringReport.events)
    ? result.proctoringReport.events
    : [];
  result.proctoringReport.mediaSegments = Array.isArray(result.proctoringReport.mediaSegments)
    ? result.proctoringReport.mediaSegments
    : [];
  result.proctoringReport.trustScore = typeof result.proctoringReport.trustScore === 'number'
    ? result.proctoringReport.trustScore
    : 100;
  result.proctoringReport.riskLevel =
    result.proctoringReport.riskLevel === 'medium' || result.proctoringReport.riskLevel === 'high'
      ? result.proctoringReport.riskLevel
      : 'low';
  result.proctoringReport.summary = result.proctoringReport.summary || defaultSummary;
  result.proctoringReport.recordingUrls = result.proctoringReport.recordingUrls ?? {};
};

const getOrCreateAssessmentResult = async (invitationId: mongoose.Types.ObjectId) => {
  let result = await AssessmentResult.findOne({ invitationId });

  if (!result) {
    result = new AssessmentResult({
      invitationId,
      responses: [],
      score: {
        total: 0,
        earned: 0,
        percentage: 0,
        breakdown: {
          mcq: { total: 0, earned: 0, count: 0 },
          msq: { total: 0, earned: 0, count: 0 },
          coding: { total: 0, earned: 0, count: 0 }
        }
      },
      status: 'in_progress',
      startedAt: new Date(),
      performanceMetrics: {
        totalTimeSpent: 0,
        averageTimePerQuestion: 0,
        questionsAttempted: 0,
        questionsSkipped: 0,
        reviewCount: 0
      },
      proctoringReport: {
        events: [],
        trustScore: 100,
        riskLevel: 'low',
        summary: defaultSummary,
        recordingUrls: {},
        mediaSegments: []
      }
    });
    await result.save();
  } else {
    ensureProctoringReport(result);
  }

  return result;
};

const applyEventImpact = (result: any, events: Array<{ severity?: string }>) => {
  const report = result.proctoringReport;
  let highestRank = severityRank[report.riskLevel] ?? 0;

  for (const event of events) {
    const normalized = typeof event.severity === 'string' ? event.severity.toLowerCase() : 'low';
    const rank = severityRank[normalized] ?? 0;
    const deduction = severityImpact[normalized] ?? 0;
    report.trustScore = Math.max(0, report.trustScore - deduction);
    highestRank = Math.max(highestRank, rank);
  }

  const resolvedRisk = Object.entries(severityRank).find(([, value]) => value === highestRank)?.[0] ?? 'low';
  report.riskLevel = resolvedRisk as 'low' | 'medium' | 'high';
  report.summary = `Recorded ${report.events.length} proctoring events · Highest severity ${resolvedRisk.toUpperCase()}`;
};

const trimCollections = (result: any) => {
  const report = result.proctoringReport;
  if (Array.isArray(report.events) && report.events.length > MAX_PROCTORING_EVENTS) {
    report.events.splice(0, report.events.length - MAX_PROCTORING_EVENTS);
  }
  if (Array.isArray(report.mediaSegments) && report.mediaSegments.length > MAX_MEDIA_SEGMENTS) {
    report.mediaSegments.splice(0, report.mediaSegments.length - MAX_MEDIA_SEGMENTS);
  }
};

const candidateProctoringController = {
  async logEvents(req: AuthenticatedRequest, res: Response) {
    try {
      const candidateSession = req.candidate;
      if (!candidateSession) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const { events } = req.body ?? {};
      const eventList: Array<{ type?: string; severity?: string; details?: unknown; occurredAt?: string | Date }> =
        Array.isArray(events) ? events : events ? [events] : [];

      if (eventList.length === 0) {
        return res.status(400).json({ success: false, message: 'No proctoring events provided' });
      }

      const invitationId = toObjectId(candidateSession.invitationId);
      const result = await getOrCreateAssessmentResult(invitationId);

      const normalizedEvents = eventList.map((event) => ({
        type: typeof event.type === 'string' ? event.type : 'unknown',
        severity: typeof event.severity === 'string' ? event.severity.toLowerCase() : 'low',
        details: event.details,
        timestamp: event.occurredAt ? new Date(event.occurredAt) : new Date()
      }));

      result.proctoringReport.events.push(...normalizedEvents);
      applyEventImpact(result, normalizedEvents);
      trimCollections(result);
      result.markModified('proctoringReport');

      await result.save();

      res.json({
        success: true,
        data: {
          eventsLogged: normalizedEvents.length,
          trustScore: result.proctoringReport.trustScore,
          riskLevel: result.proctoringReport.riskLevel
        }
      });
    } catch (error) {
      console.error('[candidateProctoringController] logEvents error', error);
      res.status(500).json({ success: false, message: 'Unable to record proctoring events' });
    }
  },

  async uploadMediaSegment(req: AuthenticatedRequest, res: Response) {
    try {
      const candidateSession = req.candidate;
      if (!candidateSession) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const { mediaType, chunk, mimeType, durationMs, sequence } = req.body ?? {};
      const normalizedType = typeof mediaType === 'string' ? mediaType.toLowerCase() : '';

      console.log(`[Proctoring] Upload request received: type=${normalizedType}, sequence=${sequence}, invitationId=${candidateSession.invitationId}`);

      if (!['screen', 'webcam', 'microphone'].includes(normalizedType)) {
        return res.status(400).json({ success: false, message: 'Unsupported media type' });
      }

      if (typeof chunk !== 'string' || chunk.length === 0) {
        return res.status(400).json({ success: false, message: 'Missing media payload' });
      }

      const encoded = chunk.includes(',') ? chunk.split(',', 2)[1] : chunk;
      const buffer = Buffer.from(encoded, 'base64');

      console.log(`[Proctoring] Media decoded: type=${normalizedType}, bufferSize=${buffer.length} bytes, base64Length=${encoded.length}`);

      if (buffer.length === 0) {
        return res.status(400).json({ success: false, message: 'Unable to decode media chunk' });
      }

      if (buffer.length < 1024) {
        console.warn('[candidateProctoringController] uploadMediaSegment warning: very small media chunk', {
          invitationId: candidateSession.invitationId,
          mediaType: normalizedType,
          sequence,
          base64Preview: encoded.slice(0, 32)
        });
      }

      if (buffer.length > 8 * 1024 * 1024) {
        return res.status(413).json({ success: false, message: 'Media chunk exceeds 8MB limit' });
      }

      const invitationId = toObjectId(candidateSession.invitationId);
      const result = await getOrCreateAssessmentResult(invitationId);

      const segmentId = `${normalizedType}-${Date.now()}-${randomUUID()}.webm`;
      const resolvedMimeType = typeof mimeType === 'string' ? mimeType : 'video/webm';

      console.log(`[Proctoring] Uploading to storage: segmentId=${segmentId}, resultId=${result._id}, size=${buffer.length}`);

      const storageInfo = await storeProctoringSegment(
        result._id.toString(),
        segmentId,
        buffer,
        resolvedMimeType
      );

      console.log(`[Proctoring] Storage complete: storage=${storageInfo.storage}, ` +
        `fileKey=${storageInfo.storage === 'r2' ? storageInfo.fileKey : 'N/A'}, ` +
        `filePath=${storageInfo.storage === 'local' ? storageInfo.filePath : 'N/A'}`);

      const segment = {
        segmentId,
        type: normalizedType,
        filePath: storageInfo.storage === 'local' ? storageInfo.filePath : undefined,
        fileKey: storageInfo.storage === 'r2' ? storageInfo.fileKey : undefined,
        publicUrl: storageInfo.storage === 'r2' ? storageInfo.publicUrl : undefined,
        storage: storageInfo.storage || 'local', // Default to 'local' if undefined
        mimeType: resolvedMimeType,
        recordedAt: new Date(),
        durationMs: typeof durationMs === 'number' ? durationMs : undefined,
        size: buffer.length,
        sequence: typeof sequence === 'number' ? sequence : undefined
      };

      result.proctoringReport.mediaSegments.push(segment);

      // Ensure recordingUrls object exists
      if (!result.proctoringReport.recordingUrls) {
        result.proctoringReport.recordingUrls = {};
      }

      // Determine the recording URL based on storage type
      let recordingUrl: string;
      if (storageInfo.storage === 'r2') {
        recordingUrl = storageInfo.publicUrl || storageInfo.fileKey || segmentId;
      } else {
        recordingUrl = storageInfo.filePath || segmentId;
      }

      result.proctoringReport.recordingUrls[normalizedType] = recordingUrl;

      console.log(`[Proctoring] Recording URL updated: ${normalizedType} = ${recordingUrl} (storage: ${storageInfo.storage})`);

      trimCollections(result);
      result.markModified('proctoringReport');
      await result.save();

      res.json({
        success: true,
        data: {
          segmentId,
          size: buffer.length,
          mimeType: segment.mimeType
        }
      });
    } catch (error) {
      console.error('[candidateProctoringController] uploadMediaSegment error', error);
      res.status(500).json({ success: false, message: 'Unable to record media segment' });
    }
  }
};

export default candidateProctoringController;
