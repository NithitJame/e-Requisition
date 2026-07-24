// Dependency-free "Export to Excel" helper. Produces a UTF-8 CSV (with BOM) that opens
// directly in Excel. Kept generic (no domain knowledge) so any table can reuse it.

/** One exportable column: a header label and a value accessor for a row of type T. */
export interface IExportColumn<T> {
  header: string;
  value: (row: T) => string | number | undefined | null;
}

/** Escapes a single CSV field per RFC 4180 (quote when it contains "," | '"' | newline). */
function toCsvField(raw: string | number | undefined | null): string {
  const text = raw === undefined || raw === null ? '' : String(raw);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * Builds a CSV string from rows + column definitions and triggers a browser download.
 * A UTF-8 BOM (﻿) is prepended so Excel renders Thai/Unicode text correctly.
 */
export function exportRowsToCsv<T>(fileName: string, columns: IExportColumn<T>[], rows: T[]): void {
  const headerLine = columns.map((c) => toCsvField(c.header)).join(',');
  const dataLines = rows.map((row) => columns.map((c) => toCsvField(c.value(row))).join(','));
  const csv = [headerLine, ...dataLines].join('\r\n');

  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.toLowerCase().endsWith('.csv') ? fileName : `${fileName}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
