import { registrableDomain } from "../core/domain";
import { suggestLabel } from "../core/labels";
import type { CaptureCandidate, ContentRequest } from "../core/types";
import { findBestForm, qualifyPassword, readCredentials, type QualifiedForm } from "./detector";
import { fillCredentials } from "./filler";
import { showSaveToast } from "./toast";

declare global {
  interface Window {
    __sitekeyLoaded?: boolean;
  }
}

let lastKey = "";
let lastAt = 0;
let prompting = false;
let navigating = false;

window.addEventListener(
  "pagehide",
  () => {
    navigating = true;
  },
  { once: true },
);

async function send(message: unknown): Promise<{ ok?: boolean; error?: string } | undefined> {
  try {
    return (await chrome.runtime.sendMessage(message)) as { ok?: boolean; error?: string };
  } catch {
    return { ok: false, error: "RUNTIME" };
  }
}

function promptSave(candidate: CaptureCandidate): void {
  if (prompting) return;
  prompting = true;

  const domain = registrableDomain(candidate.host);
  showSaveToast(candidate, async (label) => {
    const response = await send({
      type: "SAVE",
      draft: {
        domain,
        host: candidate.host,
        scope: "smart",
        username: candidate.username,
        password: candidate.password,
        label,
      },
    });
    if (!response?.ok) throw new Error(response?.error ?? "SAVE_FAILED");
  });

  setTimeout(() => {
    prompting = false;
  }, 16_000);
}

function capture(form: QualifiedForm): void {
  const credentials = readCredentials(form);
  if (!credentials) return;

  const key = `${credentials.username}\u0000${credentials.password}`;
  if (key === lastKey && Date.now() - lastAt < 2500) return;
  lastKey = key;
  lastAt = Date.now();

  const candidate: CaptureCandidate = {
    url: location.href,
    host: location.hostname,
    username: credentials.username,
    password: credentials.password,
    suggestedLabel: suggestLabel(credentials.username, document.title.slice(0, 40)),
  };

  void send({ type: "CANDIDATE", candidate });

  window.addEventListener(
    "pagehide",
    () => {
      navigating = true;
    },
    { once: true },
  );

  setTimeout(() => {
    if (navigating) return;
    void send({ type: "CANCEL_CANDIDATE" });
    promptSave(candidate);
  }, 1200);
}

function actionText(element: Element): string {
  return (
    (element as HTMLElement).innerText ||
    (element as HTMLInputElement).value ||
    element.getAttribute("aria-label") ||
    ""
  )
    .trim()
    .replace(/\s+/g, " ");
}

function init(): void {
  document.addEventListener(
    "submit",
    (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const password = form.querySelector<HTMLInputElement>('input[type="password"]');
      if (!password) return;
      const qualified = qualifyPassword(password);
      if (qualified) capture(qualified);
    },
    true,
  );

  document.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest('button, [role="button"], input[type="submit"]');
      if (!button) return;
      if (!/(登录|登入|登陆|sign\s*in|log\s*in|login)/i.test(actionText(button))) return;
      const qualified = findBestForm();
      if (qualified) capture(qualified);
    },
    true,
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Enter") return;
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || target.type !== "password") return;
      const qualified = qualifyPassword(target);
      if (qualified) capture(qualified);
    },
    true,
  );

  chrome.runtime.onMessage.addListener(
    (message: ContentRequest, _sender, sendResponse: (response?: unknown) => void) => {
      if (message.type === "SK_FILL") {
        sendResponse({ ok: fillCredentials(message.username, message.password) });
        return;
      }
      if (message.type === "SK_PROMPT_SAVE") {
        promptSave(message.candidate);
        sendResponse({ ok: true });
      }
    },
  );
}

if (!window.__sitekeyLoaded) {
  window.__sitekeyLoaded = true;
  init();
}
