import type { FormattedPartitionRow } from '../types/partitions';

export const PARTITION_CSV_HEADER = '# Name,Type,SubType,Offset,Size,Flags';

const DATA_SUBTYPE_SLUG: Record<number, string> = {
  0x00: 'ota',
  0x01: 'phy_init',
  0x02: 'nvs',
  0x03: 'coredump',
  0x04: 'nvs_keys',
  0x05: 'efuse_emulation',
  0x06: 'undefined',
  0x80: 'esphttpd_data',
  0x81: 'fat',
  0x82: 'spiffs',
  0x83: 'littlefs',
};

export function buildPartitionCsv(rows: FormattedPartitionRow[]): string {
  const lines = rows.map(row => formatPartitionCsvLine(row));
  return `${PARTITION_CSV_HEADER}\n${lines.join('\n')}`;
}

export function formatPartitionCsvLine(row: FormattedPartitionRow): string {
  const name = row.label?.trim() || row.typeLabel || 'partition';
  const typeSlug = getPartitionTypeSlug(row);
  const subtypeSlug = getPartitionSubtypeSlug(row);
  const offset = row.offsetHex || '0x0';
  const sizeHex = `0x${row.size.toString(16).toUpperCase()}`;
  return [escapeCsvValue(name), typeSlug, subtypeSlug, offset, sizeHex, ''].join(',');
}

export function getPartitionTypeSlug(row: FormattedPartitionRow): string {
  const typeValue = parsePartitionValue(row.type, row.typeHex);
  if (typeValue === 0x00) return 'app';
  if (typeValue === 0x01) return 'data';
  return `type${formatByteHex(typeValue)}`;
}

export function getPartitionSubtypeSlug(row: FormattedPartitionRow): string {
  const typeValue = parsePartitionValue(row.type, row.typeHex);
  const subtypeValue = parsePartitionValue(row.subtype, row.subtypeHex);
  if (typeValue === 0x00) {
    if (subtypeValue === 0x00) return 'factory';
    if (subtypeValue === 0x01) return 'test';
    if (subtypeValue >= 0x10 && subtypeValue <= 0x1f) return `ota_${subtypeValue - 0x10}`;
    if (subtypeValue === 0x20) return 'any';
    if (subtypeValue === 0x21) return 'ota_app';
    return `subtype${formatByteHex(subtypeValue)}`;
  }
  if (typeValue === 0x01) {
    return DATA_SUBTYPE_SLUG[subtypeValue] ?? `subtype${formatByteHex(subtypeValue)}`;
  }
  return `subtype${formatByteHex(subtypeValue)}`;
}

export function parsePartitionValue(value: number | undefined, fallback?: string | null): number {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }
  if (fallback) {
    const normalized = fallback.toLowerCase().replace(/^0x/, '');
    const parsed = Number.parseInt(normalized, 16);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return 0;
}

export function formatByteHex(value: number): string {
  return value.toString(16).padStart(2, '0').toLowerCase();
}

export function escapeCsvValue(value: string): string {
  const needsQuotes = /[",\n]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

export function encodeCsvAsBase64(value: string): string {
  if (typeof globalThis.btoa === 'function') {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(value);
    const chunkSize = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return globalThis.btoa(binary);
  }
  return Buffer.from(value, 'utf-8').toString('base64');
}

export function formatBytes(value: number | null | undefined): string | null {
  if (value == null || value < 0) {
    return null;
  }
  const units = ['bytes', 'KB', 'MB', 'GB', 'TB'];
  let bytes = value;
  let index = 0;
  while (bytes >= 1024 && index < units.length - 1) {
    bytes /= 1024;
    index += 1;
  }
  const formatted = index === 0 ? `${bytes}` : bytes.toFixed(2);
  return `${formatted} ${units[index]}`;
}

export function isReservedPartition(row: FormattedPartitionRow): boolean {
  const label = row.label?.trim().toLowerCase();
  return label === 'bootloader' || label === 'partition table';
}
