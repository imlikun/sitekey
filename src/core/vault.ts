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
import {
  getRecord,
  getSessionKey,
  getSettings,
  sessionAgeMs,
  setRecord,
  setSessionKey,
  touchSession,
} from "./storage";
import type { Entry, EntryDraft, VaultData, VaultRecord, VaultStatus } from "./types";

let cache: VaultData | null = null;

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
  return sortEntries(vault.entries.filter((entry) => entryMatchesHost(entry, host)));
}

export async function saveDraft(draft: EntryDraft): Promise<{ entry: Entry; created: boolean }> {
  await assertUnlocked();
  const vault = await readVault();
  const domain = draft.domain || registrableDomain(draft.host);
  const username = draft.username.trim();

  const existing = vault.entries.find(
    (entry) =>
      entry.domain === domain &&
      entry.username.trim().toLowerCase() === username.toLowerCase() &&
      entry.scope === draft.scope &&
      (draft.scope !== "host" || entry.host === draft.host),
  );

  if (existing) {
    existing.password = draft.password;
    existing.label = draft.label.trim() || existing.label;
    existing.note = draft.note ?? existing.note;
    existing.lastUsedAt = Date.now();
    existing.useCount += 1;
    await writeVault(vault);
    return { entry: existing, created: false };
  }

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
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
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
    password: entry.password,
    note: entry.note,
    scope: entry.scope,
    pattern: entry.pattern,
  };
  vault.entries[index] = next;
  await writeVault(vault);
  return next;
}

export async function deleteEntry(id: string): Promise<void> {
  await assertUnlocked();
  const vault = await readVault();
  const index = vault.entries.findIndex((entry) => entry.id === id);
  if (index < 0) return;
  vault.entries.splice(index, 1);
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

export async function importRecord(record: VaultRecord): Promise<void> {
  if (!record || record.v !== 1 || !record.salt || !record.verifier || !record.blob) {
    throw new Error("BAD_BACKUP");
  }
  await setRecord(record);
  await setSessionKey(null);
  cache = null;
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
    const existing = vault.entries.find(
      (entry) =>
        entry.domain === domain &&
        entry.username.trim().toLowerCase() === username.toLowerCase() &&
        entry.scope === draft.scope &&
        // 仅此域名的记录按 host 区分，否则 a.x.com 会把 b.x.com 的密码覆盖掉
        (draft.scope !== "host" || entry.host === draft.host),
    );
    if (existing) {
      existing.password = draft.password;
      if (draft.label) existing.label = draft.label;
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
        createdAt: Date.now(),
        lastUsedAt: 0,
        useCount: 0,
      });
      added += 1;
    }
  }

  await writeVault(vault);
  return { added, updated };
}
