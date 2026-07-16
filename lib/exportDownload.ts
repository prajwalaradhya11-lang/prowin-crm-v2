import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export type ExportColumn<T> = {
  key: string;
  header: string;
  value: (row: T) => string | number | null | undefined;
};

function cellToString(value: string | number | null | undefined): string {
  if (value == null) return '';
  return String(value);
}

/** RFC-style CSV escaping: quote fields that contain commas, quotes, or newlines. */
function serializeCsvValue(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Build a dated export basename without extension, e.g. recruitment_candidates_2026-07-16 */
export function buildDatedExportBasename(prefix: string, date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${prefix}_${yyyy}-${mm}-${dd}`;
}

function ensureCsvExtension(filename: string): string {
  return filename.toLowerCase().endsWith('.csv') ? filename : `${filename}.csv`;
}

/**
 * Write table rows as a CSV file under the app cache directory.
 * Returns the local file:// URI for Sharing.shareAsync.
 */
export async function exportRowsToFileUri<T>(options: {
  rows: T[];
  columns: ExportColumn<T>[];
  filename: string;
}): Promise<string> {
  const { rows, columns, filename } = options;
  if (columns.length === 0) {
    throw new Error('exportRowsToFileUri requires at least one column.');
  }

  const headers = columns.map((column) => column.header);
  const dataRows = rows.map((row) =>
    columns.map((column) => cellToString(column.value(row))),
  );

  const lines = [
    headers.map(serializeCsvValue).join(','),
    ...dataRows.map((row) => row.map(serializeCsvValue).join(',')),
  ];
  // BOM helps Excel open UTF-8 CSV correctly on Windows
  const csvContent = `\uFEFF${lines.join('\n')}`;

  const outName = ensureCsvExtension(filename);
  const baseDir = FileSystem.cacheDirectory;
  if (!baseDir) {
    throw new Error('FileSystem.cacheDirectory is unavailable on this device.');
  }

  const uri = `${baseDir}${outName}`;
  await FileSystem.writeAsStringAsync(uri, csvContent, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return uri;
}

/** Open the OS share sheet for a local file URI (Save to Files, Drive, email, etc.). */
export async function shareExportFile(
  uri: string,
  options?: { mimeType?: string; dialogTitle?: string },
): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(uri, {
    mimeType: options?.mimeType ?? 'text/csv',
    UTI: 'public.comma-separated-values-text',
    dialogTitle: options?.dialogTitle ?? 'Export CSV',
  });
}
