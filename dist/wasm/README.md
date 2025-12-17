## littlefs-wasm

Tiny, dependency-free LittleFS **and FatFS** bindings compiled with Emscripten for browsers. Both modules keep their data in RAM-backed block devices so you can mount raw flash images, mutate them entirely in the browser, and export the updated bytes without any native shims.

### Features

- Upstream LittleFS (vendored in `third_party/littlefs`) and ESP-IDF’s FatFS (elm-chan) with the same defaults we use in firmware (512-byte sectors, 32 KB cluster cap, LFN enabled).
- Configurable RAM block devices; mount existing images or start fresh.
- TypeScript-first API with no runtime dependencies.
- Ships as ES modules plus `.wasm` assets (`import.meta.url` friendly) so bundlers (Vite/Rollup/Webpack/etc.) can track them automatically.
- Minimal build pipeline (`npm run build`) produces `dist/littlefs/*` and `dist/fatfs/*` bundles ready for `public/wasm/{littlefs|fatfs}`.

### Quick Start

#### LittleFS

```ts
import { createLittleFS } from "littlefs-wasm/littlefs";

const fs = await createLittleFS({ formatOnInit: true });

fs.addFile("docs/readme.txt", "Hello LittleFS!");
fs.addFile("images/icon.bin", new Uint8Array([0xde, 0xad]));

console.log(fs.list());
// => [ { path: "docs/readme.txt", size: 16 }, { path: "images/icon.bin", size: 2 } ]

const bytes = fs.readFile("docs/readme.txt");
console.log(new TextDecoder().decode(bytes)); // "Hello LittleFS!"

fs.deleteFile("images/icon.bin");
const image = fs.toImage(); // Entire filesystem image as Uint8Array
```

#### FatFS

```ts
import { createFatFS } from "littlefs-wasm/fatfs";

const fatfs = await createFatFS({ formatOnInit: true });

fatfs.writeFile("MUSIC/track1.raw", someAudioBytes);
fatfs.writeFile("NOTES/todo.txt", "Ship FatFS preview");

console.log(fatfs.list());
// => [ { path: "MUSIC/track1.raw", size: 32768 }, { path: "NOTES/todo.txt", size: 17 } ]

const exported = fatfs.toImage(); // Persist it back to disk or flash.
```

### API surface

```ts
export async function createLittleFS(options?: LittleFSOptions): Promise<LittleFS>;
export async function createLittleFSFromImage(image: ArrayBuffer | Uint8Array, options?: LittleFSOptions): Promise<LittleFS>;

export async function createFatFS(options?: FatFSOptions): Promise<FatFS>;
export async function createFatFSFromImage(image: ArrayBuffer | Uint8Array, options?: FatFSOptions): Promise<FatFS>;

interface LittleFS {
  format(): void;
  list(): Array<{ path: string; size: number }>;
  addFile(path: string, data: Uint8Array | ArrayBuffer | string): void;
  deleteFile(path: string): void;
  readFile(path: string): Uint8Array;
  toImage(): Uint8Array;
}

interface FatFS {
  format(): void;
  list(): Array<{ path: string; size: number }>;
  writeFile(path: string, data: Uint8Array | ArrayBuffer | string): void;
  readFile(path: string): Uint8Array;
  deleteFile(path: string): void;
  toImage(): Uint8Array;
}

interface LittleFSOptions {
  blockSize?: number;      // default 512 bytes
  blockCount?: number;     // default 512 blocks (256 KiB)
  lookaheadSize?: number;  // default 32 bytes
  wasmURL?: string | URL;  // override asset resolution
  formatOnInit?: boolean;  // auto-format right after init
}

interface FatFSOptions {
  blockSize?: number;      // default 512-byte sectors
  blockCount?: number;     // default 1024 sectors (512 KiB)
  wasmURL?: string | URL;
  formatOnInit?: boolean;
}
```

`list()` returns every file (including nested directories) discovered by a depth-first walk. Entries include normalized paths and byte sizes. `createLittleFSFromImage` / `createFatFSFromImage` mount existing flash images without formatting, `toImage()` exports the current contents, and `readFile()` returns raw file bytes so your Vue client can preview text/images/audio. FatFS automatically creates missing directories for `writeFile`.

### Building from source

Requirements:

- [Emscripten](https://emscripten.org/docs/getting_started/downloads.html) (`emcc`) available in your shell.
- Node.js ≥ 18 for the TypeScript build pipeline.

Steps:

```bash
npm install
npm run build:wasm   # compiles littlefs.wasm + fatfs.wasm into dist/littlefs|fatfs
npm run build:types  # compiles src/ts -> dist (ES2020 JS + .d.ts)
# or just run both:
npm run build
```

Copy the relevant folders (`dist/littlefs/*` and `dist/fatfs/*`) into your web app (e.g., `public/wasm/littlefs/` and `public/wasm/fatfs/`). The modules default to `new URL("./littlefs.wasm", import.meta.url)` / `new URL("./fatfs.wasm", import.meta.url)`, so bundlers automatically include the binary assets.

### File layout

```
src/
  |- c/littlefs_wasm.c      # LittleFS glue + RAM block device
  |- c/fatfs_wasm.c         # FatFS glue + RAM block device
  |- ts/littlefs/index.ts   # Typed LittleFS API
  |- ts/fatfs/index.ts      # Typed FatFS API
third_party/
  |- littlefs               # Upstream LittleFS sources
  |- fatfs                  # ESP-IDF/elm-chan FatFS sources + config
scripts/build-wasm.mjs      # Builds both wasm binaries
dist/
  |- littlefs/{index.js,index.d.ts,littlefs.wasm}
  |- fatfs/{index.js,index.d.ts,fatfs.wasm}
  |- index.{js,d.ts}        # Aggregate re-export
```

### Notes

- RAM storage is initialized to `0xFF` (NOR flash style). `format()` wipes and recreates the filesystem.
- `createLittleFS` retries mounting after formatting by default; pass `formatOnInit: true` for a guaranteed clean start. FatFS behaves the same.
- When bundling, ensure both wasm assets are copied/served so `fetch(new URL("./*.wasm", import.meta.url))` succeeds.
- Error codes bubble through `LittleFSError` (LittleFS) and `FatFSError` (FatFS) with the original numeric codes (`lfs.h` / `ff.h`) so advanced clients can inspect them.

### Licensing

- `littlefs-wasm`: MIT (see `LICENSE`).
- `third_party/littlefs`: retains its upstream license (`third_party/littlefs/LICENSE.md`).
- `third_party/fatfs`: retains the FatFS license (`third_party/fatfs/LICENSE.txt`).
