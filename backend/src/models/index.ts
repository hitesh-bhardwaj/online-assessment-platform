// Import models
import OrganizationModel from './Organization';
import UserModel from './User';
import QuestionModel from './Question';
import AssessmentModel from './Assessment';
import InvitationModel from './Invitation';
import AssessmentResultModel from './AssessmentResult';
import CodeExecutionModel from './CodeExecution';
import SystemLogModel from './SystemLog';
import RefreshTokenModel from './RefreshToken';

// Central export file for all database models
export {
  default as Organization,
  IOrganization,
  IOrganizationDocument,
  IOrganizationModel,
  OrganizationStatus,
  ISignupMetadata,
  IBranding,
  ISubscription,
  ISettings
} from './Organization';
export { default as User, IUser, IPermissions, ILoginOtp } from './User';
export { default as Question, IQuestion, IOption, ITestCase, ICodingDetails } from './Question';
export { 
  default as Assessment, 
  IAssessment, 
  IQuestionRef, 
  IProctoringSettings, 
  IAssessmentSettings 
} from './Assessment';
// Add extended type for Assessment with status and publishedAt
export type IAssessmentWithStatus = import('./Assessment').IAssessment & { status?: string; publishedAt?: Date };

export { 
  default as Invitation, 
  IInvitation, 
  IInvitationDocument,
  ICandidate, 
  ISessionData, 
  IProctoringConsent,
  IInvitationModel 
} from './Invitation';
// Add extended type for Invitation with status and sentAt
export type IInvitationWithStatus = import('./Invitation').IInvitation & { status?: string; sentAt?: Date };
export {
  default as AssessmentResult,
  IAssessmentResult,
  IQuestionResponse,
  IScore,
  IProctoringEvent,
  IProctoringReport,
  IPerformanceMetrics
} from './AssessmentResult';
export {
  default as CodeExecution,
  ICodeExecution,
  ITestCaseResult,
  IExecutionEnvironment,
  ISecurityMetrics
} from './CodeExecution';
export {
  default as SystemLog,
  ISystemLog,
  ISystemLogDocument,
  ILogContext,
  IRequestDetails,
  IUserInfo,
  ISystemLogModel
} from './SystemLog';
export {
  default as RefreshToken,
  IRefreshToken
} from './RefreshToken';

// Model registry for type checking and validation
export const Models = {
  Organization: OrganizationModel,
  User: UserModel,
  Question: QuestionModel,
  Assessment: AssessmentModel,
  Invitation: InvitationModel,
  AssessmentResult: AssessmentResultModel,
  CodeExecution: CodeExecutionModel,
  SystemLog: SystemLogModel,
  RefreshToken: RefreshTokenModel
} as const;

// Type for model names
export type ModelName = keyof typeof Models;

// Helper function to get all model names
export const getModelNames = (): ModelName[] => {
  return Object.keys(Models) as ModelName[];
};

// Helper function to check if a model exists
export const hasModel = (name: string): name is ModelName => {
  return name in Models;
};
