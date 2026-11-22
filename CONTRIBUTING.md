# Contributing to ESPConnect

Thank you for your interest in contributing to ESPConnect!

## Quick rules
- Please open a Pull Request against `main` (direct pushes to `main` are disabled).
- Keep PRs focused (one feature/fix per PR if possible).
- Make sure typecheck, unit tests, and E2E tests pass.

## Development
>Prerequisite: Node.js **>= 22.17.0**.
```bash
git clone https://github.com/thelastoutpostworkshop/ESPConnect.git
cd ESPConnect
npm install
npm run dev
```

## Typecheck
- Run typecheck: `npm run typecheck`

## Unit tests
- Run all unit tests: `npm run test`
- Run a focused fixture suite: `npm run test:fatfs`
- Unit tests live under `src/` (in-source tests), `src/tests`, and `tests/` (protocol/fixture tests). E2E tests live under `tests/e2e`.

## E2E tests
- Install Playwright browsers (first time only): `npx playwright install`
- Run E2E tests: `npm run test:e2e`
- The E2E runner starts Vite with `VITE_E2E=1` and aliases the WebSerial service layer to a mock (`src/services/esptoolClient.mock.ts`).
- You can also open the app with `?e2e=1` to force the E2E path locally when running `npm run dev`.
- Unit tests use Vitest and live under `src/`, `src/tests`, and `tests/`; keep E2E tests under `tests/e2e`.

## Translations (i18n)
- Keep strings consistent with existing keys.
- Avoid changing formatting/whitespace unless required.
- Please do not translate technical terms unless the UI already does so consistently.
- Session log entries must remain English-only and must not be translated.
- Preserve placeholders exactly (e.g. `{fs}`, `{language}`, `{count}`) so the interpolation tokens remain valid across locales.
- When contributing a new language:
  1. Create a locale file under `src/locales/` (e.g. `fr.ts`) mirroring the structure in `en.ts` and translate each string section (`app`, `navigation`, `deviceInfo`, etc.).
  2. Import and register the new locale within `src/plugins/i18n.ts`, include the corresponding Vuetify bundle under `$vuetify`, and extend `supportedLocales` so it can be selected at runtime.
  3. Add the language mapping to `languageLabelKeys` in `src/App.vue` (e.g., `fr: 'language.french'`).
  4. Ensure the English `language` block (in `src/locales/en.ts`) includes the new language name. Optionally (but recommended), add the language name key to all other existing locale files (fr.ts, tr.ts, zh.ts, etc.) so the language menu displays correctly in every UI language.
