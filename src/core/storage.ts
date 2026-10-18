import type { PendingCapture, Settings, VaultRecord } from "./types";

const RECORD_KEY = "sk_record";
const SETTINGS_KEY = "sk_settings";
const KEY_KEY = "sk_key";
const AT_KEY = "sk_at";

export const DEFAULT_SETTINGS: Settings = {
  autoLockMinutes: 5,
  autoCapture: true,
  showSavePrompt: true,
};

export async function getRecord(): Promise<VaultRecord | null> {
  const stored = await chrome.storage.local.get(RECORD_KEY);
  return (stored[RECORD_KEY] as VaultRecord | undefined) ?? null;
}

export async function setRecord(record: VaultRecord | null): Promise<void> {
  if (record) await chrome.storage.local.set({ [RECORD_KEY]: record });
  else await chrome.storage.local.remove(RECORD_KEY);
}

export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  const value = stored[SETTINGS_KEY] as Partial<Settings> | undefined;
  return { ...DEFAULT_SETTINGS, ...(value ?? {}) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
}

export async function getSessionKey(): Promise<string | null> {
  const stored = await chrome.storage.session.get(KEY_KEY);
  return (stored[KEY_KEY] as string | undefined) ?? null;
}

export async function setSessionKey(key: string | null): Promise<void> {
  if (key) {
    await chrome.storage.session.set({ [KEY_KEY]: key, [AT_KEY]: Date.now() });
  } else {
    await chrome.storage.session.remove([KEY_KEY, AT_KEY]);
  }
}

export async function touchSession(): Promise<void> {
  await chrome.storage.session.set({ [AT_KEY]: Date.now() });
}

export async function sessionAgeMs(): Promise<number> {
  const stored = await chrome.storage.session.get(AT_KEY);
  const at = (stored[AT_KEY] as number | undefined) ?? 0;
  return at ? Date.now() - at : Number.POSITIVE_INFINITY;
}

export async function setPendingCapture(tabId: number, candidate: PendingCapture): Promise<void> {
  await chrome.storage.session.set({ [`sk_pending_${tabId}`]: candidate });
}

export async function takePendingCapture(tabId: number): Promise<PendingCapture | null> {
  const key = `sk_pending_${tabId}`;
  const stored = await chrome.storage.session.get(key);
  const value = stored[key] as PendingCapture | undefined;
  if (!value) return null;
  await chrome.storage.session.remove(key);
  return value;
}

export async function clearSession(): Promise<void> {
  await chrome.storage.session.clear();
}
