import type { FileSource, BinarySource } from "../shared/types";
export interface FatFSEntry {
    path: string;
    size: number;
}
export interface FatFSOptions {
    blockSize?: number;
    blockCount?: number;
    wasmURL?: string | URL;
    formatOnInit?: boolean;
}
export interface FatFS {
    format(): void;
    list(): FatFSEntry[];
    readFile(path: string): Uint8Array;
    writeFile(path: string, data: FileSource): void;
    deleteFile(path: string): void;
    toImage(): Uint8Array;
}
export declare class FatFSError extends Error {
    readonly code: number;
    constructor(message: string, code: number);
}
export declare function createFatFS(options?: FatFSOptions): Promise<FatFS>;
export declare function createFatFSFromImage(image: BinarySource, options?: FatFSOptions): Promise<FatFS>;
