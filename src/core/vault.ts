import {
  PBKDF2_ITERATIONS,
  checkVerifier,
  createVerifier,
  decryptText,
  deriveKey,
  encryptText,
  exportKey,
  fromBase64,
  importKey,
  randomId,
  toBase64,
} from "./crypto";
import { entryMatchesHost, registrableDomain, sortEntries } from "./domain";
import { mergeEntries, visibleEntries } from "./merge";
import {
  getRecord,
  getSessionKey,
  getSettings,
  sessionAgeMs,
  setRecord,
  setSessionKey,
  touchSession,
} from "./storage";
import type { Entry, EntryDraft, MatchScope, VaultData, VaultRecord, VaultStatus } from "./types";

let cache: VaultData | null = null;

/**
 * 「同一个账号」的去重判定，saveDraft 与 importDrafts 共用同一份实现。
 * 之前两处各写一遍同样的「域 + 范围 + 登录名」匹配，曾在一次改动里分叉，
 * 导致导入时同账号没被识别成重复。集中到一处，避免再走偏。
 */
function findExistingEntry(
  entries: Entry[],
  match: { domain: string; username: string; scope: MatchScope; host?: string },
): Entry | undefined {
  const username = match.username.trim().toLowerCase();
  return entries.find(
    (entry) =>
      entry.domain === match.domain &&
      entry.username.trim().toLowerCase() === username &&
      entry.scope === match.scope &&
      // 仅此域名的记录按 host 区分，否则 a.x.com 会把 b.x.com 的密码覆盖掉
      (match.scope !== "host" || entry.host === match.host),
  );
}

export async function status(): Promise<VaultStatus> {
  const record = await getRecord();
  if (!record) return "uninitialized";
  const key = await getSessionKey();
  if (!key) return "locked";

  const settings = await getSettings();
  const age = await sessionAgeMs();
  if (age > settings.autoLockMinutes * 60_000) {
    await setSessionKey(null);
    cache = null;
    return "locked";
  }
  return "unlocked";
}

export async function assertUnlocked(): Promise<void> {
  if ((await status()) !== "unlocked") throw new Error("LOCKED");
}

async function requireRecord(): Promise<VaultRecord> {
  const record = await getRecord();
  if (!record) throw new Error("NOT_INITIALIZED");
  return record;
}

async function requireKey(): Promise<CryptoKey> {
  const raw = await getSessionKey();
  if (!raw) throw new Error("LOCKED");
  return importKey(raw);
}

export async function setup(password: string): Promise<void> {
  if (await getRecord()) throw new Error("ALREADY_INITIALIZED");
  if (password.length < 8) throw new Error("WEAK_PASSWORD");

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS);
  const record: VaultRecord = {
    v: 1,
    salt: toBase64(salt),
    verifier: await createVerifier(key),
    blob: await encryptText(key, JSON.stringify({ entries: [], rules: {} })),
    iterations: PBKDF2_ITERATIONS,
    createdAt: Date.now(),
  };

  await setRecord(record);
  await setSessionKey(await exportKey(key));
  await touchSession();
  cache = { entries: [], rules: {} };
}

export async function unlock(password: string): Promise<void> {
  const record = await requireRecord();
  const key = await deriveKey(password, fromBase64(record.salt), record.iterations);
  if (!(await checkVerifier(key, record.verifier))) throw new Error("BAD_PASSWORD");
  await setSessionKey(await exportKey(key));
  await touchSession();
  cache = null;
}

export async function lock(): Promise<void> {
  await setSessionKey(null);
  cache = null;
}

export async function readVault(): Promise<VaultData> {
  if (cache) {
    await touchSession();
    return cache;
  }

  const record = await requireRecord();
  const key = await requireKey();
  const parsed = JSON.parse(await decryptText(key, record.blob)) as Partial<VaultData>;
  const vault: VaultData = {
    entries: Array.isArray(parsed.entries) ? parsed.entries : [],
    rules: parsed.rules && typeof parsed.rules === "object" ? parsed.rules : {},
  };
  cache = vault;
  await touchSession();
  return vault;
}

async function writeVault(data: VaultData): Promise<void> {
  const record = await requireRecord();
  const key = await requireKey();
  const blob = await encryptText(key, JSON.stringify(data));
  await setRecord({ ...record, blob });
  cache = data;
  await touchSession();
}

export async function listForHost(host: string): Promise<Entry[]> {
  if (!host) return [];
  await assertUnlocked();
  const vault = await readVault();
  return sortEntries(
    visibleEntries(vault.entries).filter((entry) => entryMatchesHost(entry, host)),
  );
}

export async function saveDraft(draft: EntryDraft): Promise<{ entry: Entry; created: boolean }> {
  await assertUnlocked();
  const vault = await readVault();
  const domain = draft.domain || registrableDomain(draft.host);
  const username = draft.username.trim();

  const existing = findExistingEntry(vault.entries, { domain, username, scope: draft.scope, host: draft.host });

  if (existing) {
    existing.password = draft.password;
    existing.label = draft.label.trim() || existing.label;
    existing.note = draft.note ?? existing.note;
    existing.lastUsedAt = Date.now();
    existing.updatedAt = Date.now();
    existing.useCount += 1;
    // 重新添加同一个账号等于复活，清掉墓碑
    delete existing.deletedAt;
    await writeVault(vault);
    return { entry: existing, created: false };
  }

  const now = Date.now();
  const entry: Entry = {
    id: randomId(),
    domain,
    host: draft.host,
    scope: draft.scope,
    pattern: draft.pattern,
    username,
    password: draft.password,
    label: draft.label.trim() || username,
    note: draft.note,
    createdAt: now,
    lastUsedAt: now,
    updatedAt: now,
    useCount: 1,
  };
  vault.entries.push(entry);
  await writeVault(vault);
  return { entry, created: true };
}

export async function updateEntry(entry: Entry): Promise<Entry> {
  await assertUnlocked();
  const vault = await readVault();
  const index = vault.entries.findIndex((item) => item.id === entry.id);
  if (index < 0) throw new Error("NOT_FOUND");

  const current = vault.entries[index]!;
  const next: Entry = {
    ...current,
    label: entry.label.trim() || current.label,
    username: entry.username.trim() || current.username,
    password: entry.password || current.password,
    note: entry.note,
    scope: entry.scope,
    pattern: entry.pattern,
    updatedAt: Date.now(),
  };
  vault.entries[index] = next;
  await writeVault(vault);
  return next;
}

export async function deleteEntry(id: string): Promise<void> {
  await assertUnlocked();
  const vault = await readVault();
  const entry = vault.entries.find((item) => item.id === id);
  if (!entry) return;
  // 留墓碑而不是直接抹掉：否则另一台机器合并时会把它当成「我有你没有」复活
  const now = Date.now();
  entry.deletedAt = now;
  entry.updatedAt = now;
  await writeVault(vault);
}

export async function markUsed(id: string): Promise<void> {
  const vault = await readVault();
  const entry = vault.entries.find((item) => item.id === id);
  if (!entry) return;
  entry.lastUsedAt = Date.now();
  entry.useCount += 1;
  await writeVault(vault);
}

export async function getEntry(id: string): Promise<Entry | null> {
  const vault = await readVault();
  return vault.entries.find((entry) => entry.id === id) ?? null;
}

export async function exportRecord(): Promise<VaultRecord> {
  return requireRecord();
}

export interface ImportOutcome {
  /** replaced = 本地是空库，直接接管备份；merged = 与本地合并 */
  mode: "replaced" | "merged";
  added: number;
  updated: number;
  deleted: number;
  total: number;
}

export async function importRecord(record: VaultRecord, backupPassword?: string): Promise<ImportOutcome> {
  if (!record || record.v !== 1 || !record.salt || !record.verifier || !record.blob) {
    throw new Error("BAD_BACKUP");
  }
  await assertUnlocked();
  const local = await readVault();
  const alive = visibleEntries(local.entries);

  // 本机还没有任何记录：直接接管备份，连主密码一起换掉
  if (alive.length === 0) {
    await setRecord(record);
    await setSessionKey(null);
    cache = null;
    return { mode: "replaced", added: 0, updated: 0, deleted: 0, total: 0 };
  }

  const currentRecord = await requireRecord();
  let key: CryptoKey;
  if (record.salt === currentRecord.salt) {
    key = await requireKey();
  } else {
    // 两台机器各自建过库，salt 不同：要拿备份那台的密码单独解一次
    if (!backupPassword) throw new Error("NEED_BACKUP_PASSWORD");
    key = await deriveKey(backupPassword, fromBase64(record.salt), record.iterations);
    if (!(await checkVerifier(key, record.verifier))) throw new Error("BAD_BACKUP_PASSWORD");
  }

  const parsed = JSON.parse(await decryptText(key, record.blob)) as Partial<VaultData>;
  const merged = mergeEntries(local.entries, Array.isArray(parsed.entries) ? parsed.entries : []);
  await writeVault({
    entries: merged.entries,
    rules: { ...local.rules, ...(parsed.rules ?? {}) },
  });

  return {
    mode: "merged",
    added: merged.added,
    updated: merged.updated,
    deleted: merged.deleted,
    total: visibleEntries(merged.entries).length,
  };
}

export async function clearVault(): Promise<void> {
  await setRecord(null);
  await setSessionKey(null);
  cache = null;
}

export async function changePassword(current: string, next: string): Promise<void> {
  if (next.length < 8) throw new Error("WEAK_PASSWORD");
  const record = await requireRecord();
  const oldKey = await deriveKey(current, fromBase64(record.salt), record.iterations);
  if (!(await checkVerifier(oldKey, record.verifier))) throw new Error("BAD_PASSWORD");

  const vault = await readVault();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const newKey = await deriveKey(next, salt, PBKDF2_ITERATIONS);
  const updated: VaultRecord = {
    ...record,
    salt: toBase64(salt),
    verifier: await createVerifier(newKey),
    blob: await encryptText(newKey, JSON.stringify(vault)),
    iterations: PBKDF2_ITERATIONS,
  };
  await setRecord(updated);
  await setSessionKey(await exportKey(newKey));
  await touchSession();
}

export async function importDrafts(drafts: EntryDraft[]): Promise<{ added: number; updated: number }> {
  await assertUnlocked();
  const vault = await readVault();
  let added = 0;
  let updated = 0;

  for (const draft of drafts) {
    const domain = draft.domain || registrableDomain(draft.host);
    const username = draft.username.trim();
    const existing = findExistingEntry(vault.entries, { domain, username, scope: draft.scope, host: draft.host });
    const now = Date.now();
    if (existing) {
      existing.password = draft.password;
      existing.label = draft.label.trim() || existing.label;
      // 导入就是一次修改：不写 updatedAt 的话，多机合并时这台机器会被另一台的旧密码顶回去
      existing.updatedAt = now;
      // 之前删过、现在又从 CSV 里导进来，说明这个账号还得用，把墓碑清掉
      delete existing.deletedAt;
      updated += 1;
    } else {
      vault.entries.push({
        id: randomId(),
        domain,
        host: draft.host,
        scope: draft.scope,
        pattern: draft.pattern,
        username,
        password: draft.password,
        label: draft.label.trim() || username,
        note: draft.note,
        createdAt: now,
        lastUsedAt: 0,
        updatedAt: now,
        useCount: 0,
      });
      added += 1;
    }
  }

  await writeVault(vault);
  return { added, updated };
}
