export type Language = "en" | "zh";

export function initI18n(): void;
export function translatePage(forceLang?: Language | null): void;
export function toggleLanguage(): Language;
export function switchLanguage(lang: string): Language | undefined;
export function getLanguage(): Language;
export function setLanguage(lang: Language): void;

