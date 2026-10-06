// Core data models for Tender Document Package Builder

export interface TenderInfo {
  tender_id: string;
  title: string;
  procuring_entity: string;
  bidder: string;
  submission_deadline: string; // YYYY-MM-DD
}

export interface Requirement {
  id: string;
  order: number;
  title_en: string;
  title_bn: string;
  mandatory: boolean;
  has_expiry: boolean;
}

export interface RequirementsJson {
  tender: TenderInfo;
  requirements: Requirement[];
}

export type FileProcessingStatus =
  | 'pending'
  | 'processing'
  | 'ready'
  | 'error'
  | 'duplicate';

export interface UploadedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  pageCount: number | null;
  status: FileProcessingStatus;
  error?: string;
  sha256: string | null;
  duplicateOfId?: string; // ID of the first occurrence if this is a duplicate
  objectUrl?: string;
}

export type DocStatus =
  | 'missing'
  | 'expiry_needed'
  | 'expired'
  | 'not_provided'
  | 'ok';

export interface Match {
  requirementId: string;
  fileId: string;
  expiryDate?: string; // YYYY-MM-DD, only when has_expiry=true
}

export interface RequirementStatus {
  requirement: Requirement;
  matchedFile: UploadedFile | null;
  status: DocStatus;
  expiryDate?: string;
}

export interface PackageSummary {
  totalRequirements: number;
  included: number;
  optionalNotProvided: number;
  blocking: number;
  totalInputFiles: number;
  duplicateFiles: number;
  estimatedOutputPages: number;
}

export type AppStep =
  | 'setup'
  | 'upload'
  | 'match'
  | 'validate'
  | 'review'
  | 'generate';

export type Language = 'en' | 'bn';

export interface ProjectState {
  requirements: RequirementsJson | null;
  uploadedFiles: UploadedFile[];
  matches: Match[];
  currentStep: AppStep;
  language: Language;
}
