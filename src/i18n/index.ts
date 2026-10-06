import type { Language } from '../types';
import { translations } from './translations';

export function useTranslations(language: Language) {
  return translations[language];
}

export type T = typeof translations.en;
