export function parseCsv(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const next = input[index + 1];

    if (character === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  if (quoted) throw new Error("CSV contains an unterminated quoted field.");
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);

  if (rows.length === 0) return [];
  const headers = rows[0]!.map((header) =>
    header.trim().toLowerCase().replace(/\s+/g, "_"),
  );

  return rows.slice(1).map((values, rowIndex) => ({
    rowNumber: rowIndex + 2,
    values: Object.fromEntries(
      headers.map((header, index) => [header, values[index] ?? ""]),
    ),
  }));
}

export function neutraliseSpreadsheetFormula(value: string) {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}
