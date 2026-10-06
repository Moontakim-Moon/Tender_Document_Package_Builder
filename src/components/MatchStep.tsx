import { useAppContext } from '../store/AppContext';
import { useTranslations } from '../i18n';
import { getRequirementStatuses } from '../lib/validation';
import { StatusBadge } from './StatusBadge';
import { formatBytes } from '../lib/pdf';
import { generateSmartMatchSuggestions } from '../lib/export';
import type { UploadedFile, RequirementStatus } from '../types';
import { useState } from 'react';

export function MatchStep() {
  const { state, setMatch, removeMatch, setExpiry, setStep } = useAppContext();
  const t = useTranslations(state.language);

  if (!state.requirements) return null;

  const statuses = getRequirementStatuses(
    state.requirements,
    state.uploadedFiles,
    state.matches
  );

  const matchedFileIds = new Set(state.matches.map((m) => m.fileId));

  // Available files for matching (not duplicates, not errors, not already matched)
  const availableFiles = state.uploadedFiles.filter(
    (f) => f.status === 'ready' && !matchedFileIds.has(f.id)
  );

  const allMatchableFiles = state.uploadedFiles.filter(
    (f) => f.status === 'ready' || f.status === 'duplicate'
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-header__title">{t.match.title}</h1>
        <p className="page-header__desc">{t.match.description}</p>
      </div>

      <div className="file-list" aria-label="Requirements list">
        {statuses.map((reqStatus) => (
          <RequirementMatchCard
            key={reqStatus.requirement.id}
            reqStatus={reqStatus}
            allMatchableFiles={allMatchableFiles}
            matchedFileIds={matchedFileIds}
            t={t}
            language={state.language}
            submissionDeadline={state.requirements!.tender.submission_deadline}
            onMatch={(fileId) => {
              setMatch({
                requirementId: reqStatus.requirement.id,
                fileId,
              });
            }}
            onUnmatch={() => removeMatch(reqStatus.requirement.id)}
            onSetExpiry={(date) => setExpiry(reqStatus.requirement.id, date)}
            requirements={state.requirements!.requirements}
          />
        ))}
      </div>

      {/* Unmatched files section */}
      {availableFiles.length > 0 && (
        <div className="card mt-6">
          <div className="card__header">
            <div className="card__icon" aria-hidden="true">📂</div>
            <div>
              <div className="card__title">{t.match.unmatched}</div>
              <div className="card__subtitle">
                {availableFiles.length} {state.language === 'bn' ? 'টি ফাইল মিলানো হয়নি' : 'files not matched to any requirement'}
              </div>
            </div>
          </div>
          <div className="file-list">
            {availableFiles.map((file) => (
              <div key={file.id} className="file-item">
                <div className="file-item__icon" aria-hidden="true">📄</div>
                <div className="file-item__info">
                  <div className="file-item__name">{file.name}</div>
                  <div className="file-item__meta">
                    <span>{formatBytes(file.size)}</span>
                    {file.pageCount != null && <span>{file.pageCount} pages</span>}
                  </div>
                </div>
                <span className="badge badge--optional">Unmatched</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="step-actions">
        <button className="btn btn--secondary" onClick={() => setStep('upload')} id="match-back">
          ← {t.match.backBtn}
        </button>
        <button
          className="btn btn--primary"
          onClick={() => setStep('validate')}
          id="continue-to-validate"
        >
          {t.match.continueBtn} →
        </button>
      </div>
    </div>
  );
}

interface RequirementMatchCardProps {
  reqStatus: RequirementStatus;
  allMatchableFiles: UploadedFile[];
  matchedFileIds: Set<string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any;
  language: 'en' | 'bn';
  submissionDeadline: string;
  onMatch: (fileId: string) => void;
  onUnmatch: () => void;
  onSetExpiry: (date: string) => void;
  requirements: Array<{ id: string; title_en: string; title_bn: string }>;
}

function RequirementMatchCard({
  reqStatus,
  allMatchableFiles,
  matchedFileIds,
  t,
  language,
  onMatch,
  onUnmatch,
  onSetExpiry,
  requirements: _requirements,
}: RequirementMatchCardProps) {
  const { requirement, matchedFile, status, expiryDate } = reqStatus;
  const [showSuggestions, setShowSuggestions] = useState(false);

  const title = language === 'bn' ? requirement.title_bn : requirement.title_en;

  // Files available for this slot (not matched to other requirements, OR already matched to this one)
  const filesForThisSlot = allMatchableFiles.filter(
    (f) =>
      !matchedFileIds.has(f.id) || // unmatched
      f.id === matchedFile?.id // already matched to this requirement
  );


  // Filter suggestions to files relevant to this requirement
  const fileSuggestions = !matchedFile
    ? filesForThisSlot
        .map((f) => ({
          file: f,
          score: generateSmartMatchSuggestions(f.name, [
            {
              id: requirement.id,
              title_en: requirement.title_en,
              title_bn: requirement.title_bn,
            },
          ])[0]?.score ?? 0,
        }))
        .filter((s) => s.score > 0.3)
        .sort((a, b) => b.score - a.score)
        .slice(0, 2)
    : [];

  return (
    <div
      className={`req-card status-${status}`}
      role="listitem"
      id={`req-card-${requirement.id}`}
    >
      <div className="req-card__header">
        <div className="req-card__order" aria-label={`Order ${requirement.order}`}>
          {requirement.order}
        </div>
        <div className="req-card__info">
          <div className="req-card__title">{title}</div>
          <div className="req-card__title-bn" lang={language === 'en' ? 'bn' : 'en'}>
            {language === 'en' ? requirement.title_bn : requirement.title_en}
          </div>
          <div className="req-card__badges">
            <span className={`badge badge--${requirement.mandatory ? 'mandatory' : 'optional'}`}>
              {requirement.mandatory
                ? (language === 'bn' ? 'আবশ্যিক' : 'Mandatory')
                : (language === 'bn' ? 'ঐচ্ছিক' : 'Optional')}
            </span>
            {requirement.has_expiry && (
              <span className="badge badge--expiry">
                {language === 'bn' ? 'মেয়াদ আছে' : 'Has Expiry'}
              </span>
            )}
          </div>
        </div>
        <StatusBadge status={status} label={t.statuses[status]} />
      </div>

      <div className="req-card__body">
        {/* Match controls */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label
              htmlFor={`match-select-${requirement.id}`}
              className="form-label"
            >
              {t.match.matchedWith}
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <select
                id={`match-select-${requirement.id}`}
                className="form-control form-select"
                value={matchedFile?.id ?? ''}
                onChange={(e) => {
                  if (e.target.value === '') {
                    onUnmatch();
                  } else {
                    onMatch(e.target.value);
                  }
                }}
                aria-describedby={`status-desc-${requirement.id}`}
              >
                <option value="">{t.match.selectFile}</option>
                {filesForThisSlot.map((f) => (
                  <option
                    key={f.id}
                    value={f.id}
                    disabled={f.status === 'duplicate' && f.id !== matchedFile?.id}
                  >
                    {f.name}
                    {f.pageCount != null ? ` (${f.pageCount}p)` : ''}
                    {f.status === 'duplicate' ? ' ⚠ duplicate' : ''}
                  </option>
                ))}
              </select>
              {matchedFile && (
                <button
                  className="btn btn--sm btn--secondary"
                  onClick={onUnmatch}
                  aria-label={`Unmatch ${requirement.title_en}`}
                  id={`unmatch-${requirement.id}`}
                >
                  {t.match.unmatch}
                </button>
              )}
            </div>
            <div
              id={`status-desc-${requirement.id}`}
              className="text-xs text-muted"
              style={{ marginTop: '0.25rem' }}
            >
              {t.statusDescriptions[status]}
            </div>
          </div>

          {/* Expiry date field */}
          {requirement.has_expiry && matchedFile && (
            <div style={{ minWidth: '180px' }}>
              <label
                htmlFor={`expiry-${requirement.id}`}
                className="form-label form-label--required"
              >
                {t.match.expiryDate}
              </label>
              <input
                id={`expiry-${requirement.id}`}
                type="date"
                className={`form-control ${status === 'expired' || status === 'expiry_needed' ? 'error' : ''}`}
                value={expiryDate ?? ''}
                onChange={(e) => onSetExpiry(e.target.value)}
                aria-label={`Expiry date for ${requirement.title_en}`}
                aria-required="true"
              />
            </div>
          )}
        </div>

        {/* Smart match suggestions */}
        {fileSuggestions.length > 0 && !matchedFile && (
          <div style={{ marginTop: '0.75rem' }}>
            <button
              className="btn btn--sm btn--secondary"
              onClick={() => setShowSuggestions(!showSuggestions)}
              id={`suggestions-toggle-${requirement.id}`}
            >
              💡 {t.match.smartMatch} ({fileSuggestions.length})
            </button>
            {showSuggestions && (
              <div
                style={{
                  marginTop: '0.5rem',
                  padding: '0.75rem',
                  background: 'var(--color-info-bg)',
                  border: '1px solid var(--color-info-border)',
                  borderRadius: 'var(--radius-lg)',
                }}
                aria-live="polite"
              >
                {fileSuggestions.map(({ file }) => (
                  <div
                    key={file.id}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}
                  >
                    <div>
                      <div className="text-sm font-semibold">{file.name}</div>
                      <div className="text-xs text-muted">
                        {file.pageCount} pages · Smart Match
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn btn--sm btn--primary"
                        onClick={() => { onMatch(file.id); setShowSuggestions(false); }}
                        id={`accept-suggestion-${requirement.id}-${file.id}`}
                      >
                        {t.match.accept}
                      </button>
                      <button
                        className="btn btn--sm btn--secondary"
                        onClick={() => setShowSuggestions(false)}
                        id={`reject-suggestion-${requirement.id}`}
                      >
                        {t.match.reject}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
