import { hostFromUrl, registrableDomain } from "./domain";
import { suggestLabel } from "./labels";
import type { EntryDraft } from "./types";

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export interface CsvImportResult {
  drafts: EntryDraft[];
  skipped: number;
}

export function parseChromeCsv(text: string): CsvImportResult {
  const rows = parseCsv(text);
  if (rows.length === 0) return { drafts: [], skipped: 0 };

  const header = rows[0]!.map((cell) => cell.trim().toLowerCase());
  const urlIndex = header.indexOf("url");
  const usernameIndex = header.indexOf("username");
  const passwordIndex = header.indexOf("password");
  if (urlIndex < 0 || usernameIndex < 0 || passwordIndex < 0) {
    throw new Error("CSV_MISSING_COLUMNS");
  }

  const nameIndex = header.indexOf("name");
  const noteIndex = header.indexOf("note");
  const drafts: EntryDraft[] = [];
  let skipped = 0;

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i]!;
    if (!row.some((cell) => cell.trim())) continue;

    const url = row[urlIndex]?.trim() ?? "";
    const username = row[usernameIndex]?.trim() ?? "";
    const password = row[passwordIndex] ?? "";
    const host = hostFromUrl(url);
    if (!host || !username || !password) {
      skipped += 1;
      continue;
    }

    const name = nameIndex >= 0 ? (row[nameIndex]?.trim() ?? "") : "";
    const note = noteIndex >= 0 ? (row[noteIndex]?.trim() ?? "") : "";
    drafts.push({
      domain: registrableDomain(host),
      host,
      scope: "smart",
      username,
      password,
      label: name || note || suggestLabel(username, host),
      note: note || undefined,
    });
  }

  return { drafts, skipped };
}
