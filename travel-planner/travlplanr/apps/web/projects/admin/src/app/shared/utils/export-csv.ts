/**
 * Utility to export an array of records as a CSV file download.
 * Usage: exportToCsv('customers.csv', rows, ['name', 'email', 'type', 'status'])
 */
export function exportToCsv(filename: string, rows: any[], columns: string[]): void {
  if (!rows.length) return;

  const escape = (val: any): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = columns.join(',');
  const body = rows.map(row => columns.map(col => escape(row[col])).join(','));
  const csv = [header, ...body].join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
