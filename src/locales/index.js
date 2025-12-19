import en from './en.json';
import zhCN from './zh-CN.json';

export const messages = {
  en,
  'zh-CN': zhCN,
  zh: zhCN,
};

export function detectLocale() {
  if (typeof navigator === 'undefined') return 'en';
  const lang = navigator.language || navigator.userLanguage || 'en';
  if (lang.toLowerCase().startsWith('zh')) return 'zh-CN';
  return 'en';
}
