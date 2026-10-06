import { useAppContext } from '../store/AppContext';
import { useTranslations } from '../i18n';
import {
  getRequirementStatuses,
  countBlockingIssues,
  computePackageSummary,
  getPackageDocuments,
} from '../lib/validation';
import { StatusBadge } from './StatusBadge';
import { formatDate } from '../lib/pdf';

export function ReviewStep() {
  const { state, setStep } = useAppContext();
  const t = useTranslations(state.language);

  if (!state.requirements) return null;

  const { tender } = state.requirements;
  const statuses = getRequirementStatuses(
    state.requirements,
    state.uploadedFiles,
    state.matches
  );
  const blockingCount = countBlockingIssues(statuses);
  const isReady = blockingCount === 0;
  const summary = computePackageSummary(statuses, state.uploadedFiles);
  const packageDocs = getPackageDocuments(statuses);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-header__title">{t.review.title}</h1>
      </div>

      {/* Tender Details */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card__header">
          <div className="card__icon" aria-hidden="true">🏢</div>
          <div className="card__title">{t.review.tenderDetails}</div>
        </div>
        <div className="tender-info-grid">
          <div className="tender-info-item">
            <div className="tender-info-item__label">
              {state.language === 'bn' ? 'টেন্ডার আইডি' : 'Tender ID'}
            </div>
            <div className="tender-info-item__value">{tender.tender_id}</div>
          </div>
          <div className="tender-info-item">
            <div className="tender-info-item__label">
              {state.language === 'bn' ? 'টেন্ডার শিরোনাম' : 'Tender Title'}
            </div>
            <div className="tender-info-item__value">{tender.title}</div>
          </div>
          <div className="tender-info-item">
            <div className="tender-info-item__label">
              {state.language === 'bn' ? 'ক্রয়কারী সংস্থা' : 'Procuring Entity'}
            </div>
            <div className="tender-info-item__value">{tender.procuring_entity}</div>
          </div>
          <div className="tender-info-item">
            <div className="tender-info-item__label">
              {state.language === 'bn' ? 'বিডার' : 'Bidder'}
            </div>
            <div className="tender-info-item__value">{tender.bidder}</div>
          </div>
          <div className="tender-info-item">
            <div className="tender-info-item__label">
              {state.language === 'bn' ? 'জমার শেষ তারিখ' : 'Submission Deadline'}
            </div>
            <div className="tender-info-item__value">
              {formatDate(tender.submission_deadline)}
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="stats-grid" style={{ marginBottom: '1.5rem' }} aria-label="Package summary statistics">
        <div className="stat-item">
          <div className="stat-item__value">{summary.totalRequirements}</div>
          <div className="stat-item__label">{t.review.totalRequirements}</div>
        </div>
        <div className={`stat-item ${summary.included > 0 ? 'stat-item--success' : ''}`}>
          <div className="stat-item__value">{summary.included}</div>
          <div className="stat-item__label">{t.review.included}</div>
        </div>
        <div className="stat-item">
          <div className="stat-item__value">{summary.optionalNotProvided}</div>
          <div className="stat-item__label">{t.review.optionalNotProvided}</div>
        </div>
        <div className={`stat-item ${summary.blocking > 0 ? 'stat-item--error' : 'stat-item--success'}`}>
          <div className="stat-item__value">{summary.blocking}</div>
          <div className="stat-item__label">{t.review.blocking}</div>
        </div>
        <div className="stat-item">
          <div className="stat-item__value">{summary.totalInputFiles}</div>
          <div className="stat-item__label">{t.review.totalInputFiles}</div>
        </div>
        <div className={`stat-item ${summary.duplicateFiles > 0 ? 'stat-item--warning' : ''}`}>
          <div className="stat-item__value">{summary.duplicateFiles}</div>
          <div className="stat-item__label">{t.review.duplicateFiles}</div>
        </div>
        <div className="stat-item stat-item--success">
          <div className="stat-item__value">{summary.estimatedOutputPages}</div>
          <div className="stat-item__label">{t.review.estimatedPages}</div>
        </div>
      </div>

      {/* Package Contents */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card__header">
          <div className="card__icon" aria-hidden="true">📦</div>
          <div>
            <div className="card__title">{t.review.packageContents}</div>
            <div className="card__subtitle">
              {state.language === 'bn'
                ? 'চূড়ান্ত প্যাকেজে যা অন্তর্ভুক্ত হবে'
                : 'Documents that will be included in the final package, in order'}
            </div>
          </div>
        </div>

        <table className="summary-table" aria-label="Package document order">
          <thead>
            <tr>
              <th scope="col">{t.review.order}</th>
              <th scope="col">{t.review.document}</th>
              <th scope="col">{t.review.file}</th>
              <th scope="col">{t.review.pages}</th>
              <th scope="col">{t.review.expiry}</th>
              <th scope="col">{t.review.status}</th>
            </tr>
          </thead>
          <tbody>
            {/* Cover page (always first) */}
            <tr style={{ background: 'var(--color-info-bg)' }}>
              <td style={{ fontWeight: 700 }}>—</td>
              <td style={{ fontWeight: 600 }}>
                {state.language === 'bn' ? 'কভার পেজ (স্বয়ংক্রিয়)' : 'Cover Page (auto-generated)'}
              </td>
              <td style={{ color: 'var(--color-neutral-400)', fontStyle: 'italic' }}>
                {state.language === 'bn' ? 'তৈরি করা হবে' : 'Generated automatically'}
              </td>
              <td>1</td>
              <td>—</td>
              <td>
                <span className="status-badge status-badge--ok">✓ OK</span>
              </td>
            </tr>
            {packageDocs.map((s) => (
              <tr key={s.requirement.id}>
                <td style={{ fontWeight: 700, color: 'var(--color-neutral-500)' }}>
                  {s.requirement.order}
                </td>
                <td>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                    {state.language === 'bn' ? s.requirement.title_bn : s.requirement.title_en}
                  </div>
                </td>
                <td style={{ fontSize: '0.8125rem', color: 'var(--color-neutral-700)' }}>
                  {s.matchedFile?.name}
                </td>
                <td style={{ fontSize: '0.8125rem' }}>
                  {s.matchedFile?.pageCount ?? '?'}
                </td>
                <td style={{ fontSize: '0.8125rem' }}>
                  {s.expiryDate || '—'}
                </td>
                <td>
                  <StatusBadge status={s.status} label={t.statuses[s.status]} />
                </td>
              </tr>
            ))}
            {statuses
              .filter((s) => s.status === 'not_provided')
              .map((s) => (
                <tr key={s.requirement.id} style={{ opacity: 0.6 }}>
                  <td style={{ fontWeight: 700, color: 'var(--color-neutral-400)' }}>
                    {s.requirement.order}
                  </td>
                  <td>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-neutral-500)', fontStyle: 'italic' }}>
                      {state.language === 'bn' ? s.requirement.title_bn : s.requirement.title_en}
                    </div>
                  </td>
                  <td style={{ color: 'var(--color-neutral-400)', fontStyle: 'italic', fontSize: '0.8125rem' }}>
                    {state.language === 'bn' ? 'বাদ দেওয়া হবে' : 'Skipped (optional)'}
                  </td>
                  <td>—</td>
                  <td>—</td>
                  <td>
                    <StatusBadge status={s.status} label={t.statuses[s.status]} />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Readiness message */}
      {!isReady && (
        <div className="alert alert--error" role="alert" style={{ marginBottom: '1.5rem' }}>
          <span className="alert__icon" aria-hidden="true">🚫</span>
          <div className="alert__content">
            <div className="alert__title">
              {state.language === 'bn' ? 'প্যাকেজ তৈরি করা যাচ্ছে না' : 'Cannot generate package yet'}
            </div>
            <div>
              {blockingCount} {t.validate.blockingIssues}.{' '}
              {state.language === 'bn'
                ? 'মিলান ধাপে ফিরে সমস্যা সমাধান করুন।'
                : 'Go back to the Match step to resolve them.'}
            </div>
          </div>
        </div>
      )}

      <div className="step-actions">
        <button className="btn btn--secondary" onClick={() => setStep('validate')} id="review-back">
          ← {t.review.backBtn}
        </button>
        <button
          id="generate-package-btn"
          className="btn btn--lg btn--success"
          onClick={() => setStep('generate')}
          disabled={!isReady}
          title={!isReady ? `${blockingCount} blocking issue(s) must be resolved first` : undefined}
          aria-disabled={!isReady}
          aria-describedby={!isReady ? 'generate-blocked-reason' : undefined}
        >
          {isReady ? '🚀 ' : '🔒 '}{t.review.generateBtn}
        </button>
      </div>
      {!isReady && (
        <p
          id="generate-blocked-reason"
          style={{ textAlign: 'right', fontSize: '0.8125rem', color: 'var(--color-error)', marginTop: '0.5rem' }}
        >
          {state.language === 'bn'
            ? `${blockingCount} টি বাধা সমস্যা সমাধান করুন`
            : `Resolve ${blockingCount} blocking issue(s) to enable generation`}
        </p>
      )}
    </div>
  );
}
