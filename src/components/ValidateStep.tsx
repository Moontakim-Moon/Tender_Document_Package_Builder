import { useAppContext } from '../store/AppContext';
import { useTranslations } from '../i18n';
import { getRequirementStatuses, countBlockingIssues } from '../lib/validation';
import { StatusBadge } from './StatusBadge';

export function ValidateStep() {
  const { state, setStep } = useAppContext();
  const t = useTranslations(state.language);

  if (!state.requirements) return null;

  const statuses = getRequirementStatuses(
    state.requirements,
    state.uploadedFiles,
    state.matches
  );
  const blockingCount = countBlockingIssues(statuses);
  const isReady = blockingCount === 0;

  const blockers = statuses.filter(
    (s) => s.status === 'missing' || s.status === 'expiry_needed' || s.status === 'expired'
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-header__title">{t.validate.title}</h1>
      </div>

      {/* Overall status */}
      <div
        className={`alert ${isReady ? 'alert--success' : 'alert--error'}`}
        role="alert"
        aria-live="polite"
        style={{ marginBottom: '1.5rem' }}
        id="validation-summary"
      >
        <span className="alert__icon" aria-hidden="true">
          {isReady ? '✅' : '❌'}
        </span>
        <div className="alert__content">
          <div className="alert__title">
            {isReady
              ? t.validate.packageReady
              : t.validate.packageBlocked}
          </div>
          <div>
            {isReady
              ? t.validate.allGood
              : `${blockingCount} ${t.validate.blockingIssues}`}
          </div>
        </div>
      </div>

      {/* Blocking issues */}
      {!isReady && blockers.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card__header">
            <div className="card__icon" style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)' }} aria-hidden="true">
              ⚠
            </div>
            <div>
              <div className="card__title">
                {state.language === 'bn' ? 'বাধা সমস্যাসমূহ' : 'Blocking Issues'}
              </div>
              <div className="card__subtitle">
                {state.language === 'bn'
                  ? 'এই সমস্যাগুলি সমাধান করলে প্যাকেজ তৈরি করা যাবে'
                  : 'Resolve these issues to enable package generation'}
              </div>
            </div>
          </div>
          <div className="file-list">
            {blockers.map((s) => (
              <div key={s.requirement.id} className={`file-item ${s.status === 'missing' ? 'error' : ''}`}>
                <div
                  className="file-item__icon"
                  style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)' }}
                  aria-hidden="true"
                >
                  {s.status === 'missing' ? '✗' : s.status === 'expiry_needed' ? '⏰' : '⚠'}
                </div>
                <div className="file-item__info">
                  <div className="file-item__name">
                    {state.language === 'bn' ? s.requirement.title_bn : s.requirement.title_en}
                  </div>
                  <div className="file-item__meta">
                    <span>{t.statusDescriptions[s.status]}</span>
                    {s.matchedFile && <span>File: {s.matchedFile.name}</span>}
                    {s.expiryDate && <span>Expiry: {s.expiryDate}</span>}
                  </div>
                </div>
                <StatusBadge status={s.status} label={t.statuses[s.status]} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full requirements list */}
      <div className="card">
        <div className="card__header">
          <div className="card__icon" aria-hidden="true">📋</div>
          <div>
            <div className="card__title">
              {state.language === 'bn' ? 'সকল রিকোয়ারমেন্ট' : 'All Requirements'}
            </div>
          </div>
        </div>
        <table className="summary-table" aria-label="Requirements validation status">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">{state.language === 'bn' ? 'ডকুমেন্ট' : 'Document'}</th>
              <th scope="col">{state.language === 'bn' ? 'ফাইল' : 'File'}</th>
              <th scope="col">{state.language === 'bn' ? 'মেয়াদ' : 'Expiry'}</th>
              <th scope="col">{state.language === 'bn' ? 'অবস্থা' : 'Status'}</th>
            </tr>
          </thead>
          <tbody>
            {statuses.map((s) => (
              <tr key={s.requirement.id}>
                <td style={{ fontWeight: 700, color: 'var(--color-neutral-500)' }}>
                  {s.requirement.order}
                </td>
                <td>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                    {state.language === 'bn' ? s.requirement.title_bn : s.requirement.title_en}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-neutral-500)' }}>
                    {state.language === 'en' ? s.requirement.title_bn : s.requirement.title_en}
                  </div>
                </td>
                <td style={{ fontSize: '0.8125rem' }}>
                  {s.matchedFile ? (
                    <span style={{ color: 'var(--color-neutral-700)' }}>{s.matchedFile.name}</span>
                  ) : (
                    <span style={{ color: 'var(--color-neutral-400)', fontStyle: 'italic' }}>
                      {state.language === 'bn' ? 'কোনো ফাইল নেই' : 'No file'}
                    </span>
                  )}
                </td>
                <td style={{ fontSize: '0.8125rem' }}>
                  {s.expiryDate || (
                    <span style={{ color: 'var(--color-neutral-400)' }}>—</span>
                  )}
                </td>
                <td>
                  <StatusBadge status={s.status} label={t.statuses[s.status]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="step-actions">
        <button className="btn btn--secondary" onClick={() => setStep('match')} id="validate-back">
          ← {t.validate.backBtn}
        </button>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {!isReady && (
            <span
              style={{
                fontSize: '0.875rem',
                color: 'var(--color-error)',
                fontWeight: 600,
              }}
              aria-live="polite"
            >
              {blockingCount} {t.validate.blockingIssues}
            </span>
          )}
          <button
            className="btn btn--primary"
            onClick={() => setStep('review')}
            id="continue-to-review"
          >
            {t.validate.continueBtn} →
          </button>
        </div>
      </div>
    </div>
  );
}
