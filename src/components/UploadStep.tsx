import { useRef, useState, useCallback } from 'react';
import { useAppContext } from '../store/AppContext';
import { useTranslations } from '../i18n';
import {
  computeSHA256,
  getPdfPageCount,
  isPdfMagicBytes,
  formatBytes,
  MAX_FILES,
  MAX_TOTAL_SIZE,
} from '../lib/pdf';
import type { UploadedFile } from '../types';

function generateId(): string {
  return crypto.randomUUID();
}

export function UploadStep() {
  const { state, addFile, updateFile, clearFiles, setStep } = useAppContext();
  const t = useTranslations(state.language);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const currentTotalSize = state.uploadedFiles.reduce((sum, f) => sum + f.size, 0);

  const processFiles = useCallback(
    async (rawFiles: FileList | File[]) => {
      const allFiles = Array.from(rawFiles);

      for (const file of allFiles) {
        // Check if it's not a PDF by extension/type
        const isPdfLike =
          file.type === 'application/pdf' ||
          file.name.toLowerCase().endsWith('.pdf');

        if (!isPdfLike) {
          // Add as errored file
          const errFile: UploadedFile = {
            id: generateId(),
            file,
            name: file.name,
            size: file.size,
            pageCount: null,
            status: 'error',
            error: t.upload.errors.notPdf,
            sha256: null,
          };
          addFile(errFile);
          continue;
        }

        // Check max files limit
        const currentCount = state.uploadedFiles.length;
        if (currentCount >= MAX_FILES) {
          const errFile: UploadedFile = {
            id: generateId(),
            file,
            name: file.name,
            size: file.size,
            pageCount: null,
            status: 'error',
            error: t.upload.errors.maxFiles,
            sha256: null,
          };
          addFile(errFile);
          continue;
        }

        // Check total size limit
        const newTotal = currentTotalSize + file.size;
        if (newTotal > MAX_TOTAL_SIZE) {
          const errFile: UploadedFile = {
            id: generateId(),
            file,
            name: file.name,
            size: file.size,
            pageCount: null,
            status: 'error',
            error: t.upload.errors.totalExceeded,
            sha256: null,
          };
          addFile(errFile);
          continue;
        }

        // Add with pending status
        const id = generateId();
        const pendingFile: UploadedFile = {
          id,
          file,
          name: file.name,
          size: file.size,
          pageCount: null,
          status: 'processing',
          sha256: null,
        };
        addFile(pendingFile);

        // Process asynchronously
        processFile(id, file);
      }
    },
    [state.uploadedFiles, currentTotalSize, addFile, t]
  );

  const processFile = useCallback(
    async (id: string, file: File) => {
      try {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);

        // Validate PDF magic bytes
        if (!isPdfMagicBytes(bytes)) {
          updateFile(id, {
            status: 'error',
            error: t.upload.errors.notPdf,
          });
          return;
        }

        // Compute hash
        const sha256 = await computeSHA256(buffer);

        // Check for duplicates among current files
        // We need to get current state - use functional approach
        // We'll compare hash after update
        const { pageCount, error: pdfError } = await getPdfPageCount(buffer);

        if (pdfError === 'encrypted') {
          updateFile(id, {
            status: 'error',
            error: t.upload.errors.encrypted,
            sha256,
          });
          return;
        }

        if (pdfError === 'corrupt' || pageCount === null) {
          updateFile(id, {
            status: 'error',
            error: t.upload.errors.corrupt,
            sha256,
          });
          return;
        }

        // Update with hash and page count - duplicate check happens via state
        updateFile(id, {
          status: 'ready',
          sha256,
          pageCount,
        });

        // Check for duplicates - dispatch duplicate detection after state update
        checkDuplicate(id, sha256);
      } catch (e) {
        updateFile(id, {
          status: 'error',
          error: t.upload.errors.corrupt,
        });
      }
    },
    [updateFile, t]
  );

  // This runs after state is updated - we use a callback approach
  const checkDuplicate = useCallback(
    (id: string, sha256: string) => {
      // We need to trigger a re-check on next render
      // Store the pending duplicate check
      setTimeout(() => {
        // This is handled by the DuplicateDetector component
        window.dispatchEvent(
          new CustomEvent('check-duplicate', { detail: { id, sha256 } })
        );
      }, 100);
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        processFiles(e.target.files);
      }
      e.target.value = '';
    },
    [processFiles]
  );

  const readyCount = state.uploadedFiles.filter((f) => f.status === 'ready' || f.status === 'duplicate').length;
  const processingCount = state.uploadedFiles.filter((f) => f.status === 'processing').length;
  const totalSize = state.uploadedFiles.reduce((s, f) => s + f.size, 0);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-header__title">{t.upload.title}</h1>
        <p className="page-header__desc">{t.upload.description}</p>
      </div>

      {/* Drop Zone */}
      <div
        className={`drop-zone ${isDragOver ? 'drag-over' : ''}`}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
        tabIndex={0}
        role="button"
        aria-label={t.upload.dropHint}
        style={{ marginBottom: '1.5rem' }}
      >
        <span className="drop-zone__icon" aria-hidden="true">📂</span>
        <div className="drop-zone__title">{t.upload.dropHint}</div>
        <p className="drop-zone__subtitle">
          PDF files only · Max {MAX_FILES} files · Max {formatBytes(MAX_TOTAL_SIZE)} total
        </p>
        <button
          className="btn btn--primary"
          type="button"
          onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
          id="browse-pdf-files"
        >
          {t.upload.browse}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          onChange={handleFileChange}
          className="sr-only"
          aria-label="Select PDF files to upload"
          id="pdf-file-input"
        />
      </div>

      {/* File list */}
      {state.uploadedFiles.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card__header">
            <div>
              <div className="card__title">
                {state.uploadedFiles.length} {t.upload.filesUploaded}
                {processingCount > 0 && (
                  <span style={{ marginLeft: '0.5rem', fontSize: '0.8125rem', color: 'var(--color-warning)' }}>
                    · {processingCount} processing...
                  </span>
                )}
              </div>
              <div className="card__subtitle">
                {t.upload.totalSize}: {formatBytes(totalSize)} · {readyCount} ready
              </div>
            </div>
            <button
              id="clear-all-files"
              className="btn btn--sm btn--danger"
              onClick={() => clearFiles()}
              aria-label="Clear all uploaded files"
            >
              {t.upload.clearAll}
            </button>
          </div>

          <div className="file-list" aria-label="Uploaded files list">
            {state.uploadedFiles.map((file) => (
              <FileItem key={file.id} file={file} t={t.upload} allFiles={state.uploadedFiles} />
            ))}
          </div>
        </div>
      )}

      {/* Size indicator */}
      {totalSize > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-neutral-500)', marginBottom: '0.25rem' }}>
            <span>{formatBytes(totalSize)} / {formatBytes(MAX_TOTAL_SIZE)}</span>
            <span>{Math.round((totalSize / MAX_TOTAL_SIZE) * 100)}%</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-bar__fill"
              style={{
                width: `${Math.min((totalSize / MAX_TOTAL_SIZE) * 100, 100)}%`,
                background: totalSize > MAX_TOTAL_SIZE * 0.9 ? 'var(--color-error)' : undefined,
              }}
            />
          </div>
        </div>
      )}

      <div className="step-actions">
        <button
          id="upload-back"
          className="btn btn--secondary"
          onClick={() => setStep('setup')}
        >
          ← {t.upload.backBtn}
        </button>
        <button
          id="continue-to-match"
          className="btn btn--primary"
          onClick={() => setStep('match')}
          disabled={readyCount === 0 && state.uploadedFiles.filter(f => f.status === 'duplicate').length === 0}
        >
          {t.upload.continueBtn} →
        </button>
      </div>
    </div>
  );
}

interface FileItemProps {
  file: UploadedFile;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any;
  allFiles: UploadedFile[];
}

function FileItem({ file, t, allFiles }: FileItemProps) {
  const { removeFile } = useAppContext();

  const primaryFile = file.duplicateOfId
    ? allFiles.find((f) => f.id === file.duplicateOfId)
    : null;

  const statusClass =
    file.status === 'duplicate' ? 'duplicate' : file.status === 'error' ? 'error' : '';

  return (
    <div className={`file-item ${statusClass}`} role="listitem">
      <div
        className="file-item__icon"
        aria-hidden="true"
        style={
          file.status === 'error'
            ? { background: 'var(--color-error-bg)', color: 'var(--color-error)' }
            : file.status === 'duplicate'
            ? { background: 'var(--status-expiry-bg)', color: 'var(--color-warning)' }
            : undefined
        }
      >
        {file.status === 'processing'
          ? '⏳'
          : file.status === 'error'
          ? '✗'
          : file.status === 'duplicate'
          ? '⚠'
          : '📄'}
      </div>

      <div className="file-item__info">
        <div className="file-item__name" title={file.name}>
          {file.name}
        </div>
        <div className="file-item__meta">
          <span>{formatBytes(file.size)}</span>
          {file.pageCount != null && (
            <span>
              {file.pageCount} {file.pageCount === 1 ? t.page : t.pages}
            </span>
          )}
          {file.status === 'processing' && (
            <span style={{ color: 'var(--color-warning)' }}>{t.processing}</span>
          )}
          {file.status === 'duplicate' && primaryFile && (
            <span style={{ color: 'var(--color-warning)' }}>
              {t.duplicateOf}: {primaryFile.name}
            </span>
          )}
          {file.status === 'error' && file.error && (
            <span style={{ color: 'var(--color-error)' }}>{file.error}</span>
          )}
          {file.sha256 && (
            <span
              title={`SHA-256: ${file.sha256}`}
              style={{ cursor: 'help', fontFamily: 'monospace', fontSize: '0.6875rem' }}
            >
              #{file.sha256.substring(0, 8)}
            </span>
          )}
        </div>
      </div>

      <div className="file-item__actions">
        {file.status === 'duplicate' && (
          <span className="status-badge" style={{ background: 'var(--status-expiry-bg)', color: 'var(--color-warning)', border: '1px solid var(--status-expiry-border)' }}>
            ⚠ {t.duplicate}
          </span>
        )}
        {file.status === 'ready' && (
          <span className="status-badge status-badge--ok">✓ {t.ready}</span>
        )}
        <button
          className="btn btn--icon btn--sm"
          onClick={() => removeFile(file.id)}
          aria-label={`Remove ${file.name}`}
          id={`remove-file-${file.id}`}
          title={t.remove}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
