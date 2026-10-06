/**
 * Central validation/status engine.
 * This is the SINGLE authoritative source of truth for all document statuses.
 * All UI, buttons, summaries, and PDF generation must use this module.
 */

import type {
  Requirement,
  UploadedFile,
  Match,
  RequirementsJson,
  RequirementStatus,
  DocStatus,
  PackageSummary,
} from '../types';

/**
 * Compare two date strings (YYYY-MM-DD) safely without timezone issues.
 * Returns: -1 if a < b, 0 if equal, 1 if a > b
 */
export function compareDates(a: string, b: string): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Validate a date string is in YYYY-MM-DD format and represents a real date.
 */
export function isValidDate(dateStr: string): boolean {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/**
 * Evaluate the status of a single requirement.
 * This is the ONLY place status logic lives.
 */
export function evaluateRequirementStatus(
  requirement: Requirement,
  matchedFile: UploadedFile | null,
  expiryDate: string | undefined,
  submissionDeadline: string
): DocStatus {
  const hasMatch = matchedFile !== null;

  if (!hasMatch) {
    return requirement.mandatory ? 'missing' : 'not_provided';
  }

  // File is matched
  if (requirement.has_expiry) {
    if (!expiryDate || expiryDate.trim() === '') {
      return 'expiry_needed';
    }
    // Compare expiry to deadline
    // expired: expiry < deadline
    // ok: expiry >= deadline (equal is OK per spec)
    const cmp = compareDates(expiryDate, submissionDeadline);
    if (cmp < 0) {
      return 'expired';
    }
  }

  return 'ok';
}

/**
 * Check if a status blocks package generation.
 */
export function isBlocking(status: DocStatus): boolean {
  return status === 'missing' || status === 'expiry_needed' || status === 'expired';
}

/**
 * Get all requirement statuses sorted by order.
 */
export function getRequirementStatuses(
  requirements: RequirementsJson,
  uploadedFiles: UploadedFile[],
  matches: Match[]
): RequirementStatus[] {
  const { tender, requirements: reqs } = requirements;

  const fileMap = new Map<string, UploadedFile>(
    uploadedFiles.map((f) => [f.id, f])
  );
  const matchMap = new Map<string, Match>(
    matches.map((m) => [m.requirementId, m])
  );

  const sorted = [...reqs].sort((a, b) => a.order - b.order);

  return sorted.map((req) => {
    const match = matchMap.get(req.id);
    const matchedFile = match ? (fileMap.get(match.fileId) ?? null) : null;
    const expiryDate = match?.expiryDate;

    const status = evaluateRequirementStatus(
      req,
      matchedFile,
      expiryDate,
      tender.submission_deadline
    );

    return {
      requirement: req,
      matchedFile,
      status,
      expiryDate,
    };
  });
}

/**
 * Count blocking issues from requirement statuses.
 */
export function countBlockingIssues(statuses: RequirementStatus[]): number {
  return statuses.filter((s) => isBlocking(s.status)).length;
}

/**
 * Compute package summary from current application state.
 */
export function computePackageSummary(
  statuses: RequirementStatus[],
  uploadedFiles: UploadedFile[]
): PackageSummary {
  const included = statuses.filter((s) => s.status === 'ok').length;
  const optionalNotProvided = statuses.filter(
    (s) => s.status === 'not_provided'
  ).length;
  const blocking = countBlockingIssues(statuses);
  const totalInputFiles = uploadedFiles.length;
  const duplicateFiles = uploadedFiles.filter(
    (f) => f.status === 'duplicate'
  ).length;

  const estimatedOutputPages =
    1 + // cover page
    statuses
      .filter((s) => s.status === 'ok' && s.matchedFile)
      .reduce((sum, s) => sum + (s.matchedFile?.pageCount ?? 0), 0);

  return {
    totalRequirements: statuses.length,
    included,
    optionalNotProvided,
    blocking,
    totalInputFiles,
    duplicateFiles,
    estimatedOutputPages,
  };
}

/**
 * Validate requirements.json structure.
 * Returns null if valid, or an error message if invalid.
 */
export function validateRequirementsJson(data: unknown): string | null {
  if (!data || typeof data !== 'object') {
    return 'Root must be an object';
  }

  const obj = data as Record<string, unknown>;

  // Validate tender
  if (!obj.tender || typeof obj.tender !== 'object') {
    return 'Missing "tender" object';
  }

  const tender = obj.tender as Record<string, unknown>;
  const requiredTenderFields = [
    'tender_id',
    'title',
    'procuring_entity',
    'bidder',
    'submission_deadline',
  ];

  for (const field of requiredTenderFields) {
    if (!tender[field] || typeof tender[field] !== 'string') {
      return `Missing or invalid tender field: "${field}"`;
    }
  }

  const deadline = tender.submission_deadline as string;
  if (!isValidDate(deadline)) {
    return `Invalid submission_deadline: "${deadline}". Must be YYYY-MM-DD`;
  }

  // Validate requirements array
  if (!Array.isArray(obj.requirements)) {
    return 'Missing "requirements" array';
  }

  if (obj.requirements.length === 0) {
    return 'Requirements array is empty';
  }

  const ids = new Set<string>();
  const orders = new Set<number>();

  for (let i = 0; i < obj.requirements.length; i++) {
    const req = obj.requirements[i];
    if (!req || typeof req !== 'object') {
      return `Requirement at index ${i} is not an object`;
    }

    const r = req as Record<string, unknown>;

    if (!r.id || typeof r.id !== 'string' || r.id.trim() === '') {
      return `Requirement at index ${i} has missing or invalid "id"`;
    }

    if (ids.has(r.id as string)) {
      return `Duplicate requirement id: "${r.id}"`;
    }
    ids.add(r.id as string);

    if (typeof r.order !== 'number' || !Number.isInteger(r.order) || r.order < 0) {
      return `Requirement "${r.id}" has invalid "order" (must be non-negative integer)`;
    }

    if (orders.has(r.order as number)) {
      return `Duplicate order value: ${r.order}`;
    }
    orders.add(r.order as number);

    if (!r.title_en || typeof r.title_en !== 'string') {
      return `Requirement "${r.id}" missing "title_en"`;
    }

    if (!r.title_bn || typeof r.title_bn !== 'string') {
      return `Requirement "${r.id}" missing "title_bn"`;
    }

    if (typeof r.mandatory !== 'boolean') {
      return `Requirement "${r.id}" has invalid "mandatory" (must be boolean)`;
    }

    if (typeof r.has_expiry !== 'boolean') {
      return `Requirement "${r.id}" has invalid "has_expiry" (must be boolean)`;
    }
  }

  return null;
}

/**
 * Get the list of documents to include in the package, sorted by order.
 * Only 'ok' status documents are included.
 */
export function getPackageDocuments(statuses: RequirementStatus[]): RequirementStatus[] {
  return statuses
    .filter((s) => s.status === 'ok' && s.matchedFile !== null)
    .sort((a, b) => a.requirement.order - b.requirement.order);
}
