import type { FileSource, BinarySource } from "../shared/types";
export interface LittleFSEntry {
    path: string;
    size: number;
    type: "file" | "dir";
}
export interface LittleFSOptions {
    blockSize?: number;
    blockCount?: number;
    lookaheadSize?: number;
    /**
     * Optional override for the wasm asset location. Useful when bundlers move files.
     */
    wasmURL?: string | URL;
    /**
     * Formats the filesystem immediately after initialization.
     */
    formatOnInit?: boolean;
}
export interface LittleFS {
    format(): void;
    list(path?: string): LittleFSEntry[];
    addFile(path: string, data: FileSource): void;
    writeFile(path: string, data: FileSource): void;
    deleteFile(path: string): void;
    delete(path: string, options?: {
        recursive?: boolean;
    }): void;
    mkdir(path: string): void;
    rename(oldPath: string, newPath: string): void;
    toImage(): Uint8Array;
    readFile(path: string): Uint8Array;
}
export declare class LittleFSError extends Error {
    readonly code: number;
    constructor(message: string, code: number);
}
export declare function createLittleFS(options?: LittleFSOptions): Promise<LittleFS>;
export declare function createLittleFSFromImage(image: BinarySource, options?: LittleFSOptions): Promise<LittleFS>;
