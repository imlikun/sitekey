import { hostFromUrl, registrableDomain } from "./domain";
import { suggestLabel } from "./labels";
import type { EntryDraft, MatchScope } from "./types";

/** RFC 4180 风格的字段扫描：支持引号包裹、双引号转义、字段内逗号与换行。 */
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

export type CsvRowKind = "web" | "app" | "internal" | "invalid";

export type CsvSkipReason = "no-url" | "app-only" | "internal" | "no-username" | "no-password";

export interface CsvSkip {
  reason: CsvSkipReason;
  count: number;
}

export interface CsvSample {
  label: string;
  username: string;
  host: string;
  state: "new" | "conflict";
}

export interface CsvReport {
  /** CSV 里的数据行总数（不含表头与空行） */
  total: number;
  /** 最终会写入的条数 */
  imported: number;
  /** CSV 内部完全重复、已合并的行 */
  duplicates: number;
  /** 同域名同账号但密码不同的行：只保留第一条，其余计入这里 */
  conflicts: number;
  /** 用「仅此域名」而不是「智能」导入的条数（同一站点存在多个子域时） */
  hostScoped: number;
  skipped: CsvSkip[];
  /** 按具体 host 汇总，方便用户对上号（显示 qq.com 没有意义） */
  hosts: { host: string; count: number }[];
  samples: CsvSample[];
  drafts: EntryDraft[];
}

const HEADER_ALIASES = {
  url: ["url", "website", "origin", "login_url", "site"],
  username: ["username", "login", "user", "account"],
  password: ["password", "pass"],
  name: ["name", "title"],
  note: ["note", "notes", "comment"],
};

/** 浏览器内部页面，导进来没有任何意义 */
const INTERNAL_SCHEMES = new Set([
  "chrome",
  "chrome-extension",
  "chrome-untrusted",
  "edge",
  "about",
  "file",
  "data",
  "javascript",
  "view-source",
]);

function pickColumn(header: string[], keys: readonly string[]): number {
  for (const key of keys) {
    const index = header.indexOf(key);
    if (index >= 0) return index;
  }
  return -1;
}

export function classifyUrl(raw: string): { kind: CsvRowKind; host: string; domain: string } {
  const value = raw.trim();
  if (!value) return { kind: "invalid", host: "", domain: "" };

  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(value)?.[1]?.toLowerCase() ?? "";

  // android:// 、ios:// 之类是手机 App 里的密码，桌面上没有对应的登录页
  if (scheme && scheme !== "http" && scheme !== "https") {
    return {
      kind: INTERNAL_SCHEMES.has(scheme) ? "internal" : "app",
      host: "",
      domain: "",
    };
  }

  const host = hostFromUrl(scheme ? value : `https://${value}`);
  if (!host) return { kind: "invalid", host: "", domain: "" };
  // 只有域名里带点（或 localhost）才可能是真站点，避免把 "Chrome" 之类的噪音当站点
  if (!host.includes(".") && host !== "localhost") {
    return { kind: "invalid", host: "", domain: "" };
  }
  return { kind: "web", host, domain: registrableDomain(host) };
}

interface WebRow {
  name: string;
  note: string;
  username: string;
  password: string;
  host: string;
  domain: string;
}

/** Chrome 的 name 列经常直接填成站点名，不能拿来当账号标签 */
function looksLikeSiteName(name: string, host: string, domain: string): boolean {
  const value = name.trim().toLowerCase();
  if (!value) return true;
  if (value === host || value === domain) return true;
  if (value.startsWith("www.")) return true;
  if (/^https?:\/\//.test(value)) return true;
  return false;
}

function bump(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

export function parseChromeCsv(raw: string): CsvReport {
  const text = raw.replace(/^\uFEFF/, "");
  const rows = parseCsv(text);
  const empty: CsvReport = {
    total: 0,
    imported: 0,
    duplicates: 0,
    conflicts: 0,
    hostScoped: 0,
    skipped: [],
    hosts: [],
    samples: [],
    drafts: [],
  };
  if (rows.length === 0) return empty;

  const header = rows[0]!.map((cell) => cell.replace(/^\uFEFF/, "").trim().toLowerCase());
  const urlIndex = pickColumn(header, HEADER_ALIASES.url);
  const usernameIndex = pickColumn(header, HEADER_ALIASES.username);
  const passwordIndex = pickColumn(header, HEADER_ALIASES.password);
  if (urlIndex < 0 || usernameIndex < 0 || passwordIndex < 0) {
    throw new Error("CSV_MISSING_COLUMNS");
  }
  const nameIndex = pickColumn(header, HEADER_ALIASES.name);
  const noteIndex = pickColumn(header, HEADER_ALIASES.note);

  const skipCounts = new Map<CsvSkipReason, number>();
  const byHost = new Map<string, WebRow[]>();
  const domainHosts = new Map<string, Set<string>>();
  const hostCounts = new Map<string, number>();
  let total = 0;

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i]!;
    if (!row.some((cell) => cell.trim())) continue;
    total += 1;

    const url = row[urlIndex]?.trim() ?? "";
    const username = row[usernameIndex]?.trim() ?? "";
    const password = row[passwordIndex] ?? "";

    const { kind, host, domain } = classifyUrl(url);
    if (kind === "app") {
      bump(skipCounts, "app-only");
      continue;
    }
    if (kind === "internal") {
      bump(skipCounts, "internal");
      continue;
    }
    if (kind !== "web") {
      bump(skipCounts, "no-url");
      continue;
    }
    if (!username) {
      bump(skipCounts, "no-username");
      continue;
    }
    if (!password) {
      bump(skipCounts, "no-password");
      continue;
    }

    const webRow: WebRow = {
      name: nameIndex >= 0 ? (row[nameIndex]?.trim() ?? "") : "",
      note: noteIndex >= 0 ? (row[noteIndex]?.trim() ?? "") : "",
      username,
      password,
      host,
      domain,
    };
    const bucket = byHost.get(host);
    if (bucket) bucket.push(webRow);
    else byHost.set(host, [webRow]);
    const hosts = domainHosts.get(domain);
    if (hosts) hosts.add(host);
    else domainHosts.set(domain, new Set([host]));
  }

  const drafts: EntryDraft[] = [];
  const samples: CsvSample[] = [];
  let duplicates = 0;
  let conflicts = 0;
  let hostScoped = 0;

  for (const [host, hostRows] of byHost) {
    const domain = hostRows[0]!.domain;
    // 同一个站点下有多个子域时，退化成「仅此域名」，否则 a.x.com / b.x.com 会互相覆盖
    const scope: MatchScope = (domainHosts.get(domain)?.size ?? 1) > 1 ? "host" : "smart";
    if (scope === "host") hostScoped += hostRows.length;

    // 同域名同账号：密码一样算重复，密码不同算冲突（只留第一条）
    const primaries: WebRow[] = [];
    const seen = new Map<string, WebRow>();
    for (const row of hostRows) {
      const key = row.username.trim().toLowerCase();
      const first = seen.get(key);
      if (!first) {
        seen.set(key, row);
        primaries.push(row);
        continue;
      }
      if (first.password === row.password) {
        duplicates += 1;
      } else {
        conflicts += 1;
        if (samples.length < 8) {
          samples.push({
            label: suggestLabel(row.username, row.username),
            username: row.username,
            host,
            state: "conflict",
          });
        }
      }
    }

    // name 列只有在「每个账号的名字都不一样、而且不像站点名」时才可信
    const names = primaries.map((row) => row.name.trim());
    const distinctNames = new Set(names.filter(Boolean).map((name) => name.toLowerCase()));
    const namesAreLabels =
      names.every(Boolean) &&
      distinctNames.size === primaries.length &&
      primaries.every((row) => !looksLikeSiteName(row.name, row.host, row.domain));

    const usedLabels = new Map<string, number>();
    for (const row of primaries) {
      let label = namesAreLabels ? row.name.trim() : suggestLabel(row.username, "");
      if (!label) label = row.username;
      const seenCount = (usedLabels.get(label) ?? 0) + 1;
      usedLabels.set(label, seenCount);
      if (seenCount > 1) label = `${label} ${seenCount}`;

      drafts.push({
        domain,
        host: row.host,
        scope,
        username: row.username,
        password: row.password,
        label,
        note: row.note || undefined,
      });

      hostCounts.set(row.host, (hostCounts.get(row.host) ?? 0) + 1);
      if (samples.length < 8) {
        samples.push({ label, username: row.username, host: row.host, state: "new" });
      }
    }
  }

  const skipped: CsvSkip[] = (["no-url", "app-only", "internal", "no-username", "no-password"] as const)
    .map((reason) => ({ reason, count: skipCounts.get(reason) ?? 0 }))
    .filter((item) => item.count > 0);

  const hosts = [...hostCounts.entries()]
    .map(([host, count]) => ({ host, count }))
    .sort((a, b) => b.count - a.count || a.host.localeCompare(b.host))
    .slice(0, 8);

  return {
    total,
    imported: drafts.length,
    duplicates,
    conflicts,
    hostScoped,
    skipped,
    hosts,
    samples: samples
      .filter((sample) => sample.state === "conflict")
      .concat(samples.filter((sample) => sample.state !== "conflict"))
      .slice(0, 8),
    drafts,
  };
}

/** 给界面用的精简版：去掉密码，只保留可展示的统计与样例 */
export type CsvReportSummary = Omit<CsvReport, "drafts">;

export function summarize(report: CsvReport): CsvReportSummary {
  const { drafts: _drafts, ...rest } = report;
  return rest;
}
