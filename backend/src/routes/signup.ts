import { Router } from 'express';

import signupController from '../controllers/signupController';
import { validateRequest, commonSchemas } from '../middleware/validation';

const router = Router();

const requestLinkSchema = {
  body: {
    email: {
      ...commonSchemas.email,
      errorMessage: 'A valid work email is required'
    }
  }
};

const completeSignupSchema = {
  body: {
    token: {
      isLength: { options: { min: 1 } },
      trim: true,
      errorMessage: 'Verification token is required'
    },
    organizationName: {
      ...commonSchemas.name,
      errorMessage: 'Organization name is required'
    },
    domain: {
      optional: true,
      isLength: { options: { min: 2, max: 100 } },
      trim: true,
      errorMessage: 'Domain must be between 2 and 100 characters'
    },
    plan: {
      optional: true,
      isIn: {
        options: [['free', 'basic', 'premium']],
        errorMessage: 'Plan must be free, basic, or premium'
      }
    },
    admin: {
      isObject: true,
      errorMessage: 'Admin details are required'
    },
    'admin.firstName': {
      ...commonSchemas.name,
      errorMessage: 'Admin first name is required'
    },
    'admin.lastName': {
      ...commonSchemas.name,
      errorMessage: 'Admin last name is required'
    },
    'admin.password': {
      ...commonSchemas.password,
      errorMessage: 'Admin password must meet complexity requirements'
    }
  }
};

router.post('/request-link', validateRequest(requestLinkSchema), signupController.requestLink);
router.post('/complete', validateRequest(completeSignupSchema), signupController.complete);

export default router;
