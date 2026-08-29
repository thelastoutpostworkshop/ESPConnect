import { afterEach, describe, expect, it, vi } from 'vitest';

function setNavigator(languages: string[], language?: string) {
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      languages,
      language: language ?? languages[0] ?? 'en',
    },
    configurable: true,
  });
}

function setWindowWithLocalStorage(value: string | null) {
  const localStorage = {
    getItem: vi.fn(() => value),
    setItem: vi.fn(),
  };

  Object.defineProperty(globalThis, 'window', {
    value: { localStorage },
    configurable: true,
  });

  return localStorage;
}

async function loadI18n() {
  vi.resetModules();
  return await import('./i18n');
}

afterEach(() => {
  delete (globalThis as { navigator?: unknown }).navigator;
  delete (globalThis as { window?: unknown }).window;
  vi.restoreAllMocks();
});

describe('i18n locale selection', () => {
  it('uses navigator.languages when localStorage is empty', async () => {
    setNavigator(['fr-CA', 'en-US']);
    const localStorage = setWindowWithLocalStorage(null);

    const { i18n } = await loadI18n();

    expect(localStorage.getItem).toHaveBeenCalledWith('espconnect-language');
    expect(i18n.global.locale.value).toBe('fr');
  });

  it('uses es when navigator languages include Spanish', async () => {
    setNavigator(['es-ES', 'en-US']);
    setWindowWithLocalStorage(null);

    const { i18n } = await loadI18n();

    expect(i18n.global.locale.value).toBe('es');
  });

  it('falls back to en when navigator languages are unsupported', async () => {
    setNavigator(['ja-JP']);
    setWindowWithLocalStorage(null);

    const { i18n } = await loadI18n();

    expect(i18n.global.locale.value).toBe('en');
  });
});
