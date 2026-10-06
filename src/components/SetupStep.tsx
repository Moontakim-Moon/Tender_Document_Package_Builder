import { useRef, useState, useCallback } from 'react';
import { useAppContext } from '../store/AppContext';
import { useTranslations } from '../i18n';
import { validateRequirementsJson } from '../lib/validation';
import { formatDate } from '../lib/pdf';
import type { RequirementsJson } from '../types';

export function SetupStep() {
  const { state, setRequirements, setRequirementsError, clearRequirements, setStep } =
    useAppContext();
  const t = useTranslations(state.language);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const processFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith('.json') && file.type !== 'application/json') {
        setRequirementsError('Please upload a JSON file (requirements.json)');
        return;
      }

      try {
        const text = await file.text();
        let data: unknown;

        try {
          data = JSON.parse(text);
        } catch {
          setRequirementsError(t.errors.invalidJson);
          return;
        }

        const validationError = validateRequirementsJson(data);
        if (validationError) {
          setRequirementsError(`${t.errors.parseError}: ${validationError}`);
          return;
        }

        setRequirements(data as RequirementsJson);
      } catch (e) {
        setRequirementsError(t.errors.parseError);
      }
    },
    [t, setRequirements, setRequirementsError]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      e.target.value = '';
    },
    [processFile]
  );

  const { requirements, requirementsError, language } = state;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-header__title" id="setup-title">
          {t.setup.title}
        </h1>
        <p className="page-header__desc">{t.setup.description}</p>
      </div>

      {!requirements ? (
        <div
          className={`drop-zone ${isDragOver ? 'drag-over' : ''}`}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          tabIndex={0}
          role="button"
          aria-label={t.setup.dropHint}
          aria-describedby="drop-zone-hint"
        >
          <span className="drop-zone__icon" aria-hidden="true">📋</span>
          <div className="drop-zone__title">{t.setup.dropHint}</div>
          <p className="drop-zone__subtitle" id="drop-zone-hint">
            requirements.json
          </p>
          <button
            className="btn btn--primary"
            type="button"
            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
            id="browse-requirements"
          >
            {t.setup.browse}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="sr-only"
            aria-label="Select requirements JSON file"
            id="requirements-file-input"
          />
        </div>
      ) : (
        <div className="card card--elevated">
          <div className="card__header">
            <div className="card__icon" aria-hidden="true">✅</div>
            <div>
              <div className="card__title">{t.setup.tenderInfo}</div>
              <div className="card__subtitle">
                {requirements.requirements.length} {t.setup.requirementsLoaded}
              </div>
            </div>
          </div>

          <div className="tender-info-grid mb-6">
            <TenderInfoItem label={t.setup.tenderId} value={requirements.tender.tender_id} />
            <TenderInfoItem label={t.setup.tenderTitle} value={requirements.tender.title} />
            <TenderInfoItem label={t.setup.procuringEntity} value={requirements.tender.procuring_entity} />
            <TenderInfoItem label={t.setup.bidder} value={requirements.tender.bidder} />
            <TenderInfoItem
              label={t.setup.submissionDeadline}
              value={formatDate(requirements.tender.submission_deadline)}
            />
          </div>

          <div className="section">
            <div className="section__title">
              {language === 'bn' ? 'রিকোয়ারমেন্টসমূহ' : 'Requirements'} ({requirements.requirements.length})
            </div>
            <div className="file-list">
              {[...requirements.requirements]
                .sort((a, b) => a.order - b.order)
                .map((req) => (
                  <div key={req.id} className="file-item">
                    <div
                      className="file-item__icon"
                      style={{
                        background: req.mandatory ? '#eff6ff' : '#f8fafc',
                        color: req.mandatory ? '#1d4ed8' : '#64748b',
                      }}
                      aria-hidden="true"
                    >
                      {req.mandatory ? '📄' : '📑'}
                    </div>
                    <div className="file-item__info">
                      <div className="file-item__name">
                        {language === 'bn' ? req.title_bn : req.title_en}
                      </div>
                      <div className="file-item__meta">
                        <span>
                          {language === 'bn' ? req.title_en : req.title_bn}
                        </span>
                        <span>#{req.order}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span className={`badge badge--${req.mandatory ? 'mandatory' : 'optional'}`}>
                        {req.mandatory
                          ? (language === 'bn' ? 'আবশ্যিক' : 'Mandatory')
                          : (language === 'bn' ? 'ঐচ্ছিক' : 'Optional')}
                      </span>
                      {req.has_expiry && (
                        <span className="badge badge--expiry">
                          {language === 'bn' ? 'মেয়াদ আছে' : 'Has Expiry'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <div className="step-actions">
            <button
              id="reload-requirements"
              className="btn btn--secondary"
              onClick={() => clearRequirements()}
            >
              {t.setup.reloadBtn}
            </button>
            <button
              id="continue-to-upload"
              className="btn btn--primary"
              onClick={() => setStep('upload')}
            >
              {t.setup.continueBtn} →
            </button>
          </div>
        </div>
      )}

      {requirementsError && (
        <div className="alert alert--error mt-4" role="alert" aria-live="assertive">
          <span className="alert__icon" aria-hidden="true">⚠️</span>
          <div className="alert__content">
            <div className="alert__title">Error loading requirements</div>
            <div>{requirementsError}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function TenderInfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="tender-info-item">
      <div className="tender-info-item__label">{label}</div>
      <div className="tender-info-item__value">{value || '—'}</div>
    </div>
  );
}
