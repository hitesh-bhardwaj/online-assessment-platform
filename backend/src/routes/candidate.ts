import { Router } from 'express';

import candidateAssessmentController from '../controllers/candidateAssessmentController';
import candidateProctoringController from '../controllers/candidateProctoringController';
import { authenticateCandidate } from '../middleware/auth';

const router = Router();

router.get('/assessments/:assessmentId', authenticateCandidate, candidateAssessmentController.getAssessmentContent);
router.post('/assessments/:assessmentId/start', authenticateCandidate, candidateAssessmentController.startAssessment);
router.post('/assessments/:assessmentId/progress', authenticateCandidate, candidateAssessmentController.saveAssessmentProgress);
router.post('/assessments/:assessmentId/submit', authenticateCandidate, candidateAssessmentController.submitAssessment);
router.post('/proctoring/events', authenticateCandidate, candidateProctoringController.logEvents);
router.post('/proctoring/media', authenticateCandidate, candidateProctoringController.uploadMediaSegment);

export default router;
