import { useState } from 'react';
import { useAppContext } from '../store/AppContext';
import { useTranslations } from '../i18n';
import {
  getRequirementStatuses,
  computePackageSummary,
  getPackageDocuments,
  countBlockingIssues,
} from '../lib/validation';
import {
  generatePackagePdf,
  getTodayString,
} from '../lib/pdf';
import { generateCsvChecklist, downloadFile } from '../lib/export';
import type { CoverPageData } from '../lib/pdf';

type GenerationState = 'idle' | 'generating' | 'success' | 'failed';

interface GenerationResult {
  pdfBytes: Uint8Array | null;
  totalPages: number;
  filename: string;
  includedCount: number;
  skippedCount: number;
  errorMessage?: string;
}

export function GenerateStep() {
  const { state, setStep, resetProject } = useAppContext();
  const t = useTranslations(state.language);
  const [genState, setGenState] = useState<GenerationState>('idle');
  const [result, setResult] = useState<GenerationResult | null>(null);

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

  const handleGenerate = async () => {
    if (!isReady) return;

    setGenState('generating');

    try {
      const today = getTodayString();
      const filename = `${tender.tender_id}_Package.pdf`;

      // Build cover page data
      const coverData: CoverPageData = {
        tenderId: tender.tender_id,
        tenderTitle: tender.title,
        procuringEntity: tender.procuring_entity,
        bidder: tender.bidder,
        submissionDeadline: tender.submission_deadline,
        packageDate: today,
        documents: packageDocs.map((d) => ({
          order: d.requirement.order,
          title: d.requirement.title_en,
          fileName: d.matchedFile!.name,
          pages: d.matchedFile!.pageCount ?? 0,
        })),
      };

      // Read file bytes for each document
      const documents: Array<{
        title: string;
        order: number;
        fileBytes: ArrayBuffer;
      }> = [];

      for (const doc of packageDocs) {
        if (!doc.matchedFile) continue;
        try {
          const bytes = await doc.matchedFile.file.arrayBuffer();
          documents.push({
            title: doc.requirement.title_en,
            order: doc.requirement.order,
            fileBytes: bytes,
          });
        } catch (e) {
          console.error(`Failed to read file for ${doc.requirement.title_en}:`, e);
          throw new Error(`Could not read file: ${doc.matchedFile.name}`);
        }
      }

      // Generate PDF
      const pdfBytes = await generatePackagePdf(coverData, documents);

      // Get actual page count from generated PDF (simple estimation from pdf-lib result)
      // pdf-lib returns Uint8Array; we trust our two-pass logic
      const coverPages = 1;
      const docPages = packageDocs.reduce(
        (sum, d) => sum + (d.matchedFile?.pageCount ?? 0),
        0
      );
      const totalPages = coverPages + docPages;

      setResult({
        pdfBytes,
        totalPages,
        filename,
        includedCount: packageDocs.length,
        skippedCount: summary.optionalNotProvided,
      });

      setGenState('success');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error during PDF generation';
      setResult({
        pdfBytes: null,
        totalPages: 0,
        filename: '',
        includedCount: 0,
        skippedCount: 0,
        errorMessage: msg,
      });
      setGenState('failed');
    }
  };

  const handleDownloadPdf = () => {
    if (!result?.pdfBytes) return;
    downloadFile(result.pdfBytes, result.filename, 'application/pdf');
  };

  const handleDownloadCsv = () => {
    const csvContent = generateCsvChecklist(statuses, tender.tender_id, state.language);
    const csvFilename = `${tender.tender_id}_Checklist.csv`;
    downloadFile(csvContent, csvFilename, 'text/csv;charset=utf-8');
  };

  if (genState === 'idle') {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-header__title">
            {state.language === 'bn' ? 'প্যাকেজ তৈরি করুন' : 'Generate Package'}
          </h1>
          <p className="page-header__desc">
            {state.language === 'bn'
              ? 'আপনার টেন্ডার প্যাকেজ PDF তৈরি করতে নিচের বোতাম ক্লিক করুন'
              : 'Click the button below to generate your tender package PDF'}
          </p>
        </div>

        {!isReady && (
          <div className="alert alert--error" role="alert" style={{ marginBottom: '1.5rem' }}>
            <span className="alert__icon" aria-hidden="true">🚫</span>
            <div className="alert__content">
              <div className="alert__title">
                {state.language === 'bn' ? 'প্যাকেজ তৈরি করা যাচ্ছে না' : 'Package cannot be generated'}
              </div>
              <div>
                {blockingCount}{' '}
                {state.language === 'bn' ? 'টি বাধা সমস্যা রয়েছে' : 'blocking issue(s) remain.'}
              </div>
            </div>
          </div>
        )}

        {/* Pre-generation summary */}
        <div className="card" style={{ marginBottom: '2rem' }}>
          <div className="card__header">
            <div className="card__icon" aria-hidden="true">📦</div>
            <div>
              <div className="card__title">
                {state.language === 'bn' ? 'প্যাকেজ সারসংক্ষেপ' : 'Package Summary'}
              </div>
            </div>
          </div>
          <div className="stats-grid">
            <div className="stat-item stat-item--success">
              <div className="stat-item__value">{summary.included}</div>
              <div className="stat-item__label">
                {state.language === 'bn' ? 'অন্তর্ভুক্ত' : 'Documents Included'}
              </div>
            </div>
            <div className="stat-item">
              <div className="stat-item__value">{summary.optionalNotProvided}</div>
              <div className="stat-item__label">
                {state.language === 'bn' ? 'বাদ দেওয়া (ঐচ্ছিক)' : 'Skipped (Optional)'}
              </div>
            </div>
            <div className="stat-item stat-item--success">
              <div className="stat-item__value">{summary.estimatedOutputPages}</div>
              <div className="stat-item__label">
                {state.language === 'bn' ? 'আনুমানিক পৃষ্ঠা' : 'Est. Pages'}
              </div>
            </div>
            <div className={`stat-item ${blockingCount > 0 ? 'stat-item--error' : 'stat-item--success'}`}>
              <div className="stat-item__value">{blockingCount}</div>
              <div className="stat-item__label">
                {state.language === 'bn' ? 'বাধা সমস্যা' : 'Blocking Issues'}
              </div>
            </div>
          </div>
        </div>

        <div className="step-actions">
          <button className="btn btn--secondary" onClick={() => setStep('review')} id="generate-back">
            ← {state.language === 'bn' ? 'পেছনে' : 'Back'}
          </button>
          <button
            id="generate-pdf-btn"
            className="btn btn--lg btn--success"
            onClick={handleGenerate}
            disabled={!isReady}
            aria-disabled={!isReady}
          >
            🚀 {t.generate.generating.replace('...', '').trim()
              .replace('হচ্ছে', '')
              .replace('PDF প্যাকেজ তৈরি', 'PDF প্যাকেজ তৈরি করুন')
              || (state.language === 'bn' ? 'প্যাকেজ তৈরি করুন' : 'Generate Package PDF')}
          </button>
        </div>
      </div>
    );
  }

  if (genState === 'generating') {
    return (
      <div className="success-screen" role="status" aria-live="polite">
        <div className="success-screen__icon" style={{ background: 'var(--color-info-bg)', borderColor: 'var(--color-info-border)' }}>
          <div className="spinner spinner--dark" style={{ width: '40px', height: '40px', borderWidth: '3px' }} />
        </div>
        <h2 className="success-screen__title">{t.generate.generating}</h2>
        <p className="success-screen__subtitle">
          {state.language === 'bn'
            ? 'দয়া করে অপেক্ষা করুন...'
            : 'Please wait while your package is being assembled...'}
        </p>
      </div>
    );
  }

  if (genState === 'failed') {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div className="alert alert--error" role="alert">
          <span className="alert__icon" aria-hidden="true">❌</span>
          <div className="alert__content">
            <div className="alert__title">{t.generate.failed}</div>
            <div>{result?.errorMessage}</div>
          </div>
        </div>
        <div className="step-actions" style={{ justifyContent: 'center', gap: '1rem' }}>
          <button className="btn btn--secondary" onClick={() => setGenState('idle')}>
            ↩ {state.language === 'bn' ? 'আবার চেষ্টা করুন' : 'Try Again'}
          </button>
          <button className="btn btn--secondary" onClick={() => setStep('review')}>
            ← {state.language === 'bn' ? 'রিভিউতে ফিরুন' : 'Back to Review'}
          </button>
        </div>
      </div>
    );
  }

  // Success state
  return (
    <div>
      <div className="success-screen" role="status" aria-live="polite">
        <div className="success-screen__icon">
          <span aria-hidden="true">✅</span>
        </div>
        <h2 className="success-screen__title">{t.generate.success}</h2>
        <p className="success-screen__subtitle">
          {state.language === 'bn'
            ? 'আপনার টেন্ডার প্যাকেজ সফলভাবে তৈরি হয়েছে'
            : 'Your tender package has been successfully generated'}
        </p>
      </div>

      {/* Package details */}
      <div className="card card--elevated" style={{ maxWidth: '600px', margin: '0 auto 1.5rem' }}>
        <div className="card__header">
          <div className="card__icon" aria-hidden="true">📄</div>
          <div className="card__title">
            {state.language === 'bn' ? 'প্যাকেজ বিবরণ' : 'Package Details'}
          </div>
        </div>

        <table className="summary-table">
          <tbody>
            <tr>
              <td style={{ fontWeight: 600, width: '160px' }}>
                {t.generate.filename}
              </td>
              <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                {result?.filename}
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>{t.generate.totalPages}</td>
              <td style={{ fontWeight: 700, color: 'var(--color-accent)' }}>
                {result?.totalPages}
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>{t.generate.includedDocuments}</td>
              <td>{result?.includedCount}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>{t.generate.optionalNotProvided}</td>
              <td>{result?.skippedCount}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>
                {state.language === 'bn' ? 'কভার পেজ' : 'Cover Page'}
              </td>
              <td>
                <span className="status-badge status-badge--ok">✓ Included</span>
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>
                {state.language === 'bn' ? 'ফুটার' : 'Footer (Page X of Y)'}
              </td>
              <td>
                <span className="status-badge status-badge--ok">✓ Every page</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '600px', margin: '0 auto' }}>
        <button
          id="download-package"
          className="btn btn--lg btn--primary"
          onClick={handleDownloadPdf}
          style={{ width: '100%' }}
        >
          ⬇ {t.generate.download} ({result?.filename})
        </button>
        <button
          id="download-checklist"
          className="btn btn--secondary"
          onClick={handleDownloadCsv}
          style={{ width: '100%' }}
        >
          📊 {t.generate.downloadChecklist}
        </button>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            id="review-again"
            className="btn btn--secondary"
            onClick={() => setStep('review')}
            style={{ flex: 1 }}
          >
            👁 {t.generate.reviewAgain}
          </button>
          <button
            id="new-project"
            className="btn btn--secondary"
            onClick={() => {
              if (window.confirm(
                state.language === 'bn'
                  ? 'নতুন প্রকল্প শুরু করতে চান? বর্তমান ডেটা মুছে যাবে।'
                  : 'Start a new project? Current data will be cleared.'
              )) {
                resetProject();
              }
            }}
            style={{ flex: 1 }}
          >
            🆕 {t.generate.newProject}
          </button>
        </div>
      </div>
    </div>
  );
}
