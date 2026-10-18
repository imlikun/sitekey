import type { CaptureCandidate } from "../core/types";

const HOST_ID = "sitekey-toast-host";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function showSaveToast(
  candidate: CaptureCandidate,
  onSave: (label: string) => Promise<void>,
): void {
  document.getElementById(HOST_ID)?.remove();

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.style.cssText = "position:fixed;right:20px;bottom:20px;z-index:2147483647;";
  const shadow = host.attachShadow({ mode: "open" });

  shadow.innerHTML = `
    <style>
      * { box-sizing: border-box; }
      .card {
        width: 336px;
        padding: 14px;
        border-radius: 18px;
        border: 1px solid rgba(255,255,255,.75);
        background: rgba(251,251,253,.82);
        -webkit-backdrop-filter: blur(30px) saturate(180%);
        backdrop-filter: blur(30px) saturate(180%);
        box-shadow: 0 18px 48px rgba(15,15,35,.20), 0 2px 8px rgba(15,15,35,.08), inset 0 1px 0 rgba(255,255,255,.9);
        color: #1d1d1f;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "PingFang SC", sans-serif;
        animation: sk-in .32s cubic-bezier(.2,.9,.2,1);
      }
      .head { display: flex; align-items: center; gap: 10px; }
      .tile {
        width: 32px; height: 32px; border-radius: 9px; flex: none;
        display: flex; align-items: center; justify-content: center;
        background: linear-gradient(145deg, #6d6af0, #4f46c8);
        box-shadow: inset 0 1px 0 rgba(255,255,255,.35);
      }
      .titles { flex: 1; min-width: 0; }
      .title { font-size: 13.5px; font-weight: 600; letter-spacing: -.01em; }
      .sub { font-size: 11.5px; color: #79797f; margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .close {
        appearance: none; border: 0; background: transparent; color: #8e8e93;
        width: 24px; height: 24px; border-radius: 7px; cursor: pointer;
        display: flex; align-items: center; justify-content: center; flex: none;
      }
      .close:hover { background: rgba(120,120,128,.12); color: #3a3a3c; }
      .label { display: block; margin: 12px 0 5px; font-size: 11.5px; font-weight: 500; color: #6e6e73; }
      .input {
        width: 100%; height: 34px; padding: 0 10px; border-radius: 9px;
        border: 1px solid rgba(60,60,67,.14); background: rgba(255,255,255,.65);
        color: #1d1d1f; font: inherit; font-size: 13px; outline: none;
        transition: border-color .16s, box-shadow .16s;
      }
      .input:focus { border-color: #5856d6; box-shadow: 0 0 0 3px rgba(88,86,214,.14); }
      .user {
        display: flex; align-items: center; gap: 6px; margin-top: 9px;
        font-size: 12px; color: #6e6e73;
      }
      .user span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .actions { display: flex; gap: 8px; margin-top: 13px; }
      .btn {
        appearance: none; height: 32px; border-radius: 9px; font: inherit;
        font-size: 12.5px; font-weight: 500; cursor: pointer; flex: 1;
        border: 1px solid rgba(60,60,67,.14); background: rgba(255,255,255,.55); color: #1d1d1f;
        transition: transform .14s, background .14s;
      }
      .btn:active { transform: scale(.98); }
      .btn.primary { background: #5856d6; border-color: #5856d6; color: #fff; }
      .btn.primary:hover { background: #4d4bc4; }
      .btn.ghost:hover { background: rgba(255,255,255,.95); }
      .saved { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500; padding: 8px 2px; }
      .saved small { color: #6e6e73; font-weight: 400; }
      .error { color: #d70015; font-size: 12px; margin-top: 8px; }
      @keyframes sk-in { from { opacity: 0; transform: translateY(12px) scale(.98); } to { opacity: 1; transform: none; } }
      @keyframes sk-out { to { opacity: 0; transform: translateY(8px) scale(.98); } }
      .card.leaving { animation: sk-out .2s ease forwards; }
      @media (prefers-color-scheme: dark) {
        .card { background: rgba(38,38,44,.84); border-color: rgba(255,255,255,.12); color: #f5f5f7; box-shadow: 0 18px 48px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.08); }
        .sub, .label, .user { color: #a1a1a6; }
        .input { background: rgba(255,255,255,.06); border-color: rgba(255,255,255,.12); color: #f5f5f7; }
        .btn { background: rgba(255,255,255,.06); border-color: rgba(255,255,255,.12); color: #f5f5f7; }
        .btn.primary { background: #7d7aff; border-color: #7d7aff; color: #14141a; }
        .close:hover { background: rgba(255,255,255,.1); color: #f5f5f7; }
        .error { color: #ff6961; }
      }
      @media (prefers-reduced-motion: reduce) {
        .card, .card.leaving { animation: none; }
      }
    </style>
    <div class="card" role="dialog" aria-label="保存登录到 SiteKey">
      <div class="head">
        <div class="tile">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4.5" y="10.5" width="15" height="10" rx="2.6"/><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7"/>
          </svg>
        </div>
        <div class="titles">
          <div class="title">保存这个登录？</div>
          <div class="sub">${escapeHtml(candidate.host)}</div>
        </div>
        <button class="close" aria-label="关闭">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>
      <label class="label" for="sk-label">标签，用来区分同站点的多个账号</label>
      <input id="sk-label" class="input" value="${escapeHtml(candidate.suggestedLabel)}" maxlength="48" autocomplete="off" spellcheck="false">
      <div class="user">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="3.4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg>
        <span>${escapeHtml(candidate.username)}</span>
      </div>
      <div class="actions">
        <button class="btn ghost" data-action="ignore">忽略</button>
        <button class="btn primary" data-action="save">保存</button>
      </div>
    </div>
  `;

  document.documentElement.appendChild(host);

  const card = shadow.querySelector<HTMLElement>(".card")!;
  const input = shadow.querySelector<HTMLInputElement>(".input")!;
  const saveButton = shadow.querySelector<HTMLButtonElement>('[data-action="save"]')!;
  const ignoreButton = shadow.querySelector<HTMLButtonElement>('[data-action="ignore"]')!;
  const closeButton = shadow.querySelector<HTMLButtonElement>(".close")!;

  let closing = false;
  const close = () => {
    if (closing) return;
    closing = true;
    card.classList.add("leaving");
    setTimeout(() => host.remove(), 200);
  };

  const timer = setTimeout(close, 15_000);
  card.addEventListener("mouseenter", () => clearTimeout(timer));
  card.addEventListener("mouseleave", () => setTimeout(close, 6_000));

  closeButton.addEventListener("click", close);
  ignoreButton.addEventListener("click", close);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") void save();
    if (event.key === "Escape") close();
  });

  async function save(): Promise<void> {
    const label = input.value.trim() || candidate.suggestedLabel;
    saveButton.disabled = true;
    saveButton.textContent = "保存中…";
    try {
      await onSave(label);
      card.innerHTML = `
        <div class="saved">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1d9e75" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5l4.6 4.6L19.5 6.7"/></svg>
          <span>已保存 <small>${escapeHtml(label)}</small></span>
        </div>
      `;
      setTimeout(close, 2200);
    } catch {
      saveButton.disabled = false;
      saveButton.textContent = "保存";
      const error = shadow.querySelector<HTMLElement>(".error") ?? document.createElement("div");
      error.className = "error";
      error.textContent = "保存失败，请确认 SiteKey 已解锁。";
      card.appendChild(error);
    }
  }

  saveButton.addEventListener("click", () => void save());
  setTimeout(() => input.select(), 80);
}
