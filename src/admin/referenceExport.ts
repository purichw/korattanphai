/** A read-only export of the displayed columns and the rows chosen by the operator. */
export function referenceCsv(columns: string[], rows: { cells: string[] }[]): string {
  const field = (value: string) => {
    // Spreadsheet programs may ignore leading whitespace/control characters before
    // evaluating a formula. Prefix unsafe cells as text without removing content.
    const leading = value.match(/^[\s\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f]*/u)?.[0] ?? '';
    const control = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/u.test(leading);
    const formula = /^[=+\-@]/.test(value.slice(leading.length));
    // Signed decimal coordinates are data; expressions such as -1+2 are not.
    const negativeNumber = /^-(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value) && Number.isFinite(Number(value));
    const text = control || (formula && !negativeNumber) ? `'${value}` : value;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return '\uFEFF' + [columns, ...rows.map(row => row.cells)].map(row => row.map(field).join(',')).join('\r\n');
}
