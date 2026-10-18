export type MatchScope = "smart" | "host" | "domain" | "custom";

export interface Entry {
  id: string;
  /** Registrable domain, e.g. example.com */
  domain: string;
  /** Exact host where this credential was captured, e.g. login.example.com */
  host: string;
  scope: MatchScope;
  /** Used when scope === "custom", e.g. *.example.com */
  pattern?: string;
  username: string;
  password: string;
  /** Human label, e.g. 客户A · 公众号 */
  label: string;
  note?: string;
  createdAt: number;
  lastUsedAt: number;
  useCount: number;
}

export interface SiteRule {
  domain: string;
  capture: boolean;
  prompt: boolean;
  neverPrompt?: boolean;
}

export interface VaultData {
  entries: Entry[];
  rules: Record<string, SiteRule>;
}

export interface VaultRecord {
  v: 1;
  salt: string;
  verifier: string;
  blob: string;
  iterations: number;
  createdAt: number;
}

export interface Settings {
  autoLockMinutes: number;
  autoCapture: boolean;
  showSavePrompt: boolean;
}

export type VaultStatus = "uninitialized" | "locked" | "unlocked";

export interface EntryDraft {
  domain: string;
  host: string;
  scope: MatchScope;
  pattern?: string;
  username: string;
  password: string;
  label: string;
  note?: string;
}

export interface CaptureCandidate {
  url: string;
  host: string;
  username: string;
  password: string;
  suggestedLabel: string;
}

export interface PendingCapture extends CaptureCandidate {
  ts: number;
}

export type Request =
  | { type: "STATUS" }
  | { type: "SETUP"; password: string }
  | { type: "UNLOCK"; password: string }
  | { type: "LOCK" }
  | { type: "LIST"; url: string }
  | { type: "SAVE"; draft: EntryDraft }
  | { type: "UPDATE"; entry: Entry }
  | { type: "DELETE"; id: string }
  | { type: "FILL"; id: string; tabId?: number }
  | { type: "GET_SETTINGS" }
  | { type: "SET_SETTINGS"; settings: Partial<Settings> }
  | { type: "EXPORT" }
  | { type: "IMPORT"; record: VaultRecord }
  | { type: "IMPORT_CSV"; text: string; dryRun?: boolean }
  | { type: "CHANGE_PASSWORD"; current: string; next: string }
  | { type: "CLEAR" }
  | { type: "REFRESH_BADGE" }
  | { type: "CANDIDATE"; candidate: CaptureCandidate }
  | { type: "CANCEL_CANDIDATE" };

export type ContentRequest =
  | { type: "SK_FILL"; username: string; password: string }
  | { type: "SK_PROMPT_SAVE"; candidate: PendingCapture }
  | { type: "SK_PING" };

export type Response<T = Record<string, unknown>> =
  | ({ ok: true } & T)
  | { ok: false; error: string };
