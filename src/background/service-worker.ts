import { hostFromUrl, registrableDomain } from "../core/domain";
import { parseChromeCsv } from "../core/csv";
import { getSettings, saveSettings, setPendingCapture, takePendingCapture } from "../core/storage";
import type { ContentRequest, PendingCapture, Request, Response } from "../core/types";
import {
  assertUnlocked,
  changePassword,
  clearVault,
  deleteEntry,
  exportRecord,
  getEntry,
  importDrafts,
  importRecord,
  listForHost,
  lock,
  markUsed,
  readVault,
  saveDraft,
  setup,
  status,
  unlock,
  updateEntry,
} from "../core/vault";

const BADGE_COLOR = "#5856D6";

async function refreshBadgeForTab(tabId: number, url: string): Promise<void> {
  const host = hostFromUrl(url);
  if (!host) {
    await chrome.action.setBadgeText({ tabId, text: "" });
    return;
  }
  if ((await status()) !== "unlocked") {
    await chrome.action.setBadgeText({ tabId, text: "" });
    return;
  }
  try {
    const entries = await listForHost(host);
    await chrome.action.setBadgeText({ tabId, text: entries.length ? String(entries.length) : "" });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLOR });
    await chrome.action.setBadgeTextColor?.({ tabId, color: "#FFFFFF" });
  } catch {
    await chrome.action.setBadgeText({ tabId, text: "" });
  }
}

async function refreshActiveBadge(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) await refreshBadgeForTab(tab.id, tab.url ?? "");
}

async function fillEntry(id: string, tabId?: number): Promise<void> {
  const entry = await getEntry(id);
  if (!entry) throw new Error("NOT_FOUND");

  const targetTab = tabId ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
  if (!targetTab) throw new Error("NO_TAB");

  const message: ContentRequest = {
    type: "SK_FILL",
    username: entry.username,
    password: entry.password,
  };

  try {
    await chrome.tabs.sendMessage(targetTab, message);
  } catch {
    throw new Error("NO_CONTENT_SCRIPT");
  }
  await markUsed(id);
}

async function handle(request: Request, sender: chrome.runtime.MessageSender): Promise<Response> {
  switch (request.type) {
    case "STATUS":
      return { ok: true, status: await status() };

    case "SETUP":
      await setup(request.password);
      await refreshActiveBadge();
      return { ok: true };

    case "UNLOCK":
      await unlock(request.password);
      await refreshActiveBadge();
      return { ok: true };

    case "LOCK":
      await lock();
      await refreshActiveBadge();
      return { ok: true };

    case "LIST": {
      const host = hostFromUrl(request.url);
      const entries = await listForHost(host);
      return { ok: true, host, domain: registrableDomain(host), entries };
    }

    case "SAVE": {
      const result = await saveDraft(request.draft);
      await refreshActiveBadge();
      return { ok: true, ...result };
    }

    case "UPDATE":
      await updateEntry(request.entry);
      await refreshActiveBadge();
      return { ok: true };

    case "DELETE":
      await deleteEntry(request.id);
      await refreshActiveBadge();
      return { ok: true };

    case "FILL":
      await fillEntry(request.id, request.tabId);
      return { ok: true };

    case "GET_SETTINGS":
      return { ok: true, settings: await getSettings() };

    case "SET_SETTINGS":
      return { ok: true, settings: await saveSettings(request.settings) };

    case "EXPORT":
      return { ok: true, record: await exportRecord() };

    case "IMPORT":
      await importRecord(request.record);
      await refreshActiveBadge();
      return { ok: true };

    case "IMPORT_CSV": {
      await assertUnlocked();
      const parsed = parseChromeCsv(request.text);
      const counts = await importDrafts(parsed.drafts);
      await refreshActiveBadge();
      return { ok: true, ...counts, skipped: parsed.skipped };
    }

    case "CHANGE_PASSWORD":
      await changePassword(request.current, request.next);
      return { ok: true };

    case "CLEAR":
      await clearVault();
      await refreshActiveBadge();
      return { ok: true };

    case "REFRESH_BADGE":
      await refreshActiveBadge();
      return { ok: true };

    case "CANDIDATE": {
      const tabId = sender.tab?.id;
      if (!tabId) return { ok: false, error: "NO_TAB" };
      if ((await status()) !== "unlocked") return { ok: false, error: "LOCKED" };

      const settings = await getSettings();
      if (!settings.autoCapture || !settings.showSavePrompt) return { ok: true, ignored: true };

      const vault = await readVault();
      const domain = registrableDomain(request.candidate.host);
      const rule = vault.rules[domain];
      if (rule?.neverPrompt) return { ok: true, ignored: true };

      const pending: PendingCapture = { ...request.candidate, ts: Date.now() };
      await setPendingCapture(tabId, pending);
      return { ok: true };
    }

    case "CANCEL_CANDIDATE": {
      const tabId = sender.tab?.id;
      if (tabId) await chrome.storage.session.remove(`sk_pending_${tabId}`);
      return { ok: true };
    }

    default:
      return { ok: false, error: "UNKNOWN_REQUEST" };
  }
}

chrome.runtime.onMessage.addListener((request: Request, sender, sendResponse) => {
  handle(request, sender)
    .then((result) => sendResponse(result))
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
      sendResponse({ ok: false, error: message });
    });
  return true;
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs
    .get(tabId)
    .then((tab) => refreshBadgeForTab(tabId, tab.url ?? ""))
    .catch(() => undefined);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  void (async () => {
    await refreshBadgeForTab(tabId, tab.url ?? changeInfo.url ?? "");
    const pending = await takePendingCapture(tabId);
    if (!pending) return;
    if (Date.now() - pending.ts > 60_000) return;
    setTimeout(() => {
      chrome.tabs
        .sendMessage(tabId, { type: "SK_PROMPT_SAVE", candidate: pending } satisfies ContentRequest)
        .catch(() => undefined);
    }, 800);
  })();
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== "fill-last") return;
  void (async () => {
    if ((await status()) !== "unlocked") return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    const host = hostFromUrl(tab.url);
    if (!host) return;
    const entries = await listForHost(host);
    if (entries.length === 0) return;
    await fillEntry(entries[0]!.id, tab.id);
  })().catch(() => undefined);
});

chrome.runtime.onInstalled.addListener(() => {
  void chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
  void refreshActiveBadge();
});

chrome.runtime.onStartup.addListener(() => {
  void refreshActiveBadge();
});
