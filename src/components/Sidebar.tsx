import { useAppContext } from '../store/AppContext';
import { useTranslations } from '../i18n';
import type { AppStep } from '../types';
import { getRequirementStatuses, countBlockingIssues } from '../lib/validation';

const STEPS: AppStep[] = ['setup', 'upload', 'match', 'validate', 'review', 'generate'];

const STEP_ICONS: Record<AppStep, string> = {
  setup: '📋',
  upload: '📤',
  match: '🔗',
  validate: '✓',
  review: '👁',
  generate: '⬇',
};

export function Sidebar() {
  const { state, setStep } = useAppContext();
  const t = useTranslations(state.language);

  const stepLabels: Record<AppStep, string> = {
    setup: t.steps.setup,
    upload: t.steps.upload,
    match: t.steps.match,
    validate: t.steps.validate,
    review: t.steps.review,
    generate: t.steps.generate,
  };

  const currentStepIndex = STEPS.indexOf(state.currentStep);

  // Compute package health
  let readyCount = 0;
  let totalCount = 0;
  let blockingCount = 0;

  if (state.requirements) {
    const statuses = getRequirementStatuses(
      state.requirements,
      state.uploadedFiles,
      state.matches
    );
    totalCount = statuses.length;
    readyCount = statuses.filter((s) => s.status === 'ok').length;
    blockingCount = countBlockingIssues(statuses);
  }

  const isStepEnabled = (step: AppStep): boolean => {
    const idx = STEPS.indexOf(step);
    if (idx === 0) return true;
    if (!state.requirements) return false;
    if (idx <= currentStepIndex + 1) return true;
    return false;
  };

  const isStepCompleted = (step: AppStep): boolean => {
    const idx = STEPS.indexOf(step);
    return idx < currentStepIndex;
  };

  return (
    <aside className="app-sidebar" aria-label="Navigation steps">
      <nav className="step-nav" role="navigation">
        {STEPS.map((step) => {
          const idx = STEPS.indexOf(step);
          const enabled = isStepEnabled(step);
          const completed = isStepCompleted(step);
          const active = step === state.currentStep;

          return (
            <button
              key={step}
              id={`step-nav-${step}`}
              className={`step-nav__item ${active ? 'active' : ''} ${completed ? 'completed' : ''} ${!enabled ? 'disabled' : ''}`}
              onClick={() => enabled && setStep(step)}
              disabled={!enabled}
              aria-current={active ? 'step' : undefined}
              aria-label={`Step ${idx + 1}: ${stepLabels[step]}`}
            >
              <span className="step-nav__indicator" aria-hidden="true">
                {completed ? '✓' : idx + 1}
              </span>
              <span className="step-nav__content">
                <span className="step-nav__label">
                  <span aria-hidden="true">{STEP_ICONS[step]} </span>
                  {stepLabels[step]}
                </span>
              </span>
            </button>
          );
        })}
      </nav>

      {state.requirements && (
        <div className="health-widget" aria-label="Package health status">
          <div className="health-widget__title">Package Health</div>
          <div
            className="health-widget__bar"
            role="progressbar"
            aria-valuenow={totalCount > 0 ? Math.round((readyCount / totalCount) * 100) : 0}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={`health-widget__fill ${blockingCount > 0 ? 'blocked' : readyCount === totalCount ? 'ready' : 'partial'}`}
              style={{ width: totalCount > 0 ? `${(readyCount / totalCount) * 100}%` : '0%' }}
            />
          </div>
          <div className="health-widget__stats">
            <span className="health-widget__ready">{readyCount}</span>
            <span> / {totalCount} ready</span>
            {blockingCount > 0 && (
              <span>
                {' · '}
                <span className="health-widget__blocked">{blockingCount} blocking</span>
              </span>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
