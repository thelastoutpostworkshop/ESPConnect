import type { FileSource, BinarySource } from "../shared/types";

/**
 * Maximum filename length (ESP-IDF default: 64)
 */
export declare const LFS_NAME_MAX: number;

/**
 * LittleFS disk version 2.0 (0x00020000)
 * Use this for maximum compatibility with older implementations.
 */
export declare const DISK_VERSION_2_0: number;

/**
 * LittleFS disk version 2.1 (0x00020001)
 * Latest version with additional features.
 */
export declare const DISK_VERSION_2_1: number;

/**
 * Format disk version as human-readable string (e.g., "2.0", "2.1")
 */
export declare function formatDiskVersion(version: number): string;

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
    /**
     * Disk version to use when formatting new filesystems.
     * Use DISK_VERSION_2_0 for compatibility with older ESP implementations.
     * Use DISK_VERSION_2_1 for latest features.
     * 
     * IMPORTANT: Setting this prevents automatic migration of older filesystems.
     */
    diskVersion?: number;
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
    /**
     * Get the disk version of the mounted filesystem.
     * @returns Version as 32-bit number (e.g., 0x00020000 for v2.0)
     */
    getDiskVersion(): number;
    /**
     * Get filesystem usage statistics.
     */
    getUsage(): { capacityBytes: number; usedBytes: number; freeBytes: number };
}

export declare class LittleFSError extends Error {
    readonly code: number;
    constructor(message: string, code: number);
}

export declare function createLittleFS(options?: LittleFSOptions): Promise<LittleFS>;
export declare function createLittleFSFromImage(image: BinarySource, options?: LittleFSOptions): Promise<LittleFS>;
