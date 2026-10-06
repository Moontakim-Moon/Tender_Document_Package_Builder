import { useAppContext } from '../store/AppContext';
import { useTranslations } from '../i18n';

export function Header() {
  const { state, setLanguage } = useAppContext();
  const t = useTranslations(state.language);

  return (
    <header className="app-header" role="banner">
      <div className="app-header__brand">
        <div className="app-header__title">{t.appTitle}</div>
        <div className="app-header__subtitle">{t.appSubtitle}</div>
      </div>

      <div className="app-header__actions">
        <div
          className="lang-toggle"
          role="group"
          aria-label="Language selection"
        >
          <button
            id="lang-en"
            className={`lang-toggle__btn ${state.language === 'en' ? 'active' : ''}`}
            onClick={() => setLanguage('en')}
            aria-pressed={state.language === 'en'}
            lang="en"
          >
            EN
          </button>
          <button
            id="lang-bn"
            className={`lang-toggle__btn ${state.language === 'bn' ? 'active' : ''}`}
            onClick={() => setLanguage('bn')}
            aria-pressed={state.language === 'bn'}
            lang="bn"
          >
            বাং
          </button>
        </div>
      </div>
    </header>
  );
}
