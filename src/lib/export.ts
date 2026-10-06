/**
 * CSV export functionality for checklist generation.
 */

import type { RequirementStatus } from '../types';
import type { Language } from '../types';

/**
 * Generate CSV checklist from requirement statuses.
 * UTF-8 with BOM for correct Bangla display in Excel.
 */
export function generateCsvChecklist(
  statuses: RequirementStatus[],
  _tenderId: string,
  language: Language
): string {
  const BOM = '\uFEFF';
  
  const headers = language === 'bn'
    ? ['ক্রম', 'ডকুমেন্ট (বাংলা)', 'ডকুমেন্ট (ইংরেজি)', 'ফাইলের নাম', 'পৃষ্ঠা', 'মেয়াদ তারিখ', 'অবস্থা']
    : ['Order', 'Document (English)', 'Document (Bangla)', 'File Name', 'Pages', 'Expiry Date', 'Status'];

  const statusLabels: Record<string, Record<Language, string>> = {
    missing: { en: 'Missing', bn: 'অনুপস্থিত' },
    expiry_needed: { en: 'Expiry Date Needed', bn: 'মেয়াদ তারিখ প্রয়োজন' },
    expired: { en: 'Expired', bn: 'মেয়াদ শেষ' },
    not_provided: { en: 'Not Provided', bn: 'প্রদান করা হয়নি' },
    ok: { en: 'OK', bn: 'ঠিক আছে' },
  };

  const rows = statuses.map((s) => {
    const cells = [
      String(s.requirement.order),
      s.requirement.title_en,
      s.requirement.title_bn,
      s.matchedFile?.name ?? '',
      s.matchedFile?.pageCount != null ? String(s.matchedFile.pageCount) : '',
      s.expiryDate ?? '',
      statusLabels[s.status]?.[language] ?? s.status,
    ];
    return cells.map(escapeCSV).join(',');
  });

  const csvContent = [headers.map(escapeCSV).join(','), ...rows].join('\r\n');
  return BOM + csvContent;
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Trigger a file download in the browser.
 */
export function downloadFile(
  content: Uint8Array | string,
  filename: string,
  mimeType: string
): void {
  const blob =
    typeof content === 'string'
      ? new Blob([content], { type: mimeType })
      : new Blob([content as unknown as BlobPart], { type: mimeType });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  // Revoke after a short delay to ensure download starts
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Generate smart match suggestions based on filename similarity.
 */
export function generateSmartMatchSuggestions(
  fileName: string,
  requirements: Array<{ id: string; title_en: string; title_bn: string }>
): Array<{ requirementId: string; title: string; score: number; reason: string }> {
  const normalizedFile = normalizeString(fileName.replace(/\.[^.]+$/, '')); // Remove extension

  const suggestions = requirements.map((req) => {
    const normalizedEn = normalizeString(req.title_en);
    const normalizedBn = normalizeString(req.title_bn);
    const normalizedId = normalizeString(req.id);

    const scoreEn = similarityScore(normalizedFile, normalizedEn);
    const scoreBn = similarityScore(normalizedFile, normalizedBn);
    const scoreId = similarityScore(normalizedFile, normalizedId);
    const maxScore = Math.max(scoreEn, scoreBn, scoreId);

    let reason = '';
    if (maxScore === scoreEn && scoreEn > 0) reason = `Matches "${req.title_en}"`;
    else if (maxScore === scoreBn && scoreBn > 0) reason = `Matches "${req.title_bn}"`;
    else if (maxScore === scoreId && scoreId > 0) reason = `Matches requirement ID "${req.id}"`;

    return {
      requirementId: req.id,
      title: req.title_en,
      score: maxScore,
      reason,
    };
  });

  return suggestions
    .filter((s) => s.score > 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[_\-./\\]/g, ' ')
    .replace(/[^a-z0-9\s\u0980-\u09FF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function similarityScore(a: string, b: string): number {
  if (!a || !b) return 0;

  const tokensA = new Set(a.split(' ').filter(Boolean));
  const tokensB = new Set(b.split(' ').filter(Boolean));

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let matches = 0;
  tokensA.forEach((token) => {
    if (tokensB.has(token)) matches++;
    else {
      // Check partial match (one contains the other)
      tokensB.forEach((bToken) => {
        if (token.length > 3 && (token.includes(bToken) || bToken.includes(token))) {
          matches += 0.5;
        }
      });
    }
  });

  return matches / Math.max(tokensA.size, tokensB.size);
}
