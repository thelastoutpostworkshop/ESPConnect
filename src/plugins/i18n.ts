import { createI18n } from 'vue-i18n';
import en from '../locales/en';
import fr from '../locales/fr';
import zh from '../locales/zh';
import tr from '../locales/tr';
import { en as vuetifyEn, fr as vuetifyFr, zhHans as vuetifyZhHans, tr as vuetifyTr } from 'vuetify/locale';

const STORAGE_KEY = 'espconnect-language';
const supportedLocales = ['en', 'fr', 'zh', 'tr'] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

function normalizeLocale(value: unknown): SupportedLocale {
  if (typeof value !== 'string') {
    return 'en';
  }

  const normalized = value.toLowerCase();
  return supportedLocales.includes(normalized as SupportedLocale)
    ? (normalized as SupportedLocale)
    : 'en';
}

function getBrowserLocale(): SupportedLocale {
  if (typeof navigator === 'undefined') {
    return 'en';
  }

  const locales = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const locale of locales) {
    if (typeof locale !== 'string' || !locale) {
      continue;
    }
    const lang = locale.substring(0, 2).toLowerCase();
    if (supportedLocales.includes(lang as SupportedLocale)) {
      return lang as SupportedLocale;
    }
  }

  return 'en';
}

function readStoredLocale(): SupportedLocale {
  if (typeof window !== 'undefined' && window.localStorage) {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return normalizeLocale(stored);
    }
  }
  return getBrowserLocale();
}

const locale = readStoredLocale();

export const i18n = createI18n({
  legacy: false,
  locale: locale as string,
  fallbackLocale: 'en',
  messages: {
    en: {
      ...en,
      $vuetify: vuetifyEn,
    },
    fr: {
      ...fr,
      $vuetify: vuetifyFr,
    },
    zh: {
      ...zh,
      $vuetify: vuetifyZhHans,
    },
    tr: {
      ...tr,
      $vuetify: vuetifyTr,
    },
  },
});

export function getLanguage(): SupportedLocale {
  return normalizeLocale(i18n.global.locale.value);
}

export function setLanguage(next: string): SupportedLocale {
  const normalized = normalizeLocale(next);
  i18n.global.locale.value = normalized;

  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, normalized);
  }

  return normalized;
}
