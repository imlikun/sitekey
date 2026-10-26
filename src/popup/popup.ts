import "./popup.css";
import { hostFromUrl, registrableDomain } from "../core/domain";
import {
  DEFAULT_GEN_OPTIONS,
  generatePassword,
  passwordScore,
  type GenOptions,
} from "../core/generator";
import { hueOf, initialOf, relativeTime, suggestLabel } from "../core/labels";
import type { Entry, MatchScope, Request, VaultStatus } from "../core/types";
import { installMock } from "./mock";

const isExtension = typeof chrome !== "undefined" && Boolean(chrome.runtime?.id);
if (!isExtension) {
  installMock();
  document.body.classList.add("preview");
}

const screen = document.getElementById("screen") as HTMLElement;
const backdrop = document.getElementById("backdrop") as HTMLElement;
const sheet = document.getElementById("sheet") as HTMLElement;
const snack = document.getElementById("snack") as HTMLElement;

const state = {
  status: "locked" as VaultStatus,
  url: "",
  host: "",
  domain: "",
  entries: [] as Entry[],
  query: "",
};

const ERRORS: Record<string, string> = {
  BAD_PASSWORD: "主密码不正确",
  WEAK_PASSWORD: "主密码至少 8 位",
  ALREADY_INITIALIZED: "保险库已经初始化",
  NOT_INITIALIZED: "还没有创建保险库",
  LOCKED: "保险库已锁定，请重新解锁",
  NOT_FOUND: "找不到这条记录",
  NO_CONTENT_SCRIPT: "这个页面不允许扩展写入，可以点 ⋯ 复制密码",
  NO_PASSWORD_FIELD: "这一页没找到登录输入框，可以点 ⋯ 复制密码",
  NO_TAB: "找不到当前标签页",
  BAD_BACKUP: "备份文件无效",
  CSV_MISSING_COLUMNS: "CSV 缺少 url / username / password 列",
  UNKNOWN: "操作失败，请重试",
};

function humanError(error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  return ERRORS[code] ?? "操作失败，请重试";
}

async function rpc(request: Request): Promise<Record<string, any>> {
  const response = await chrome.runtime.sendMessage(request);
  if (!response || response.ok !== true) throw new Error(response?.error ?? "UNKNOWN");
  return response as Record<string, any>;
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

const icons = {
  lock: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.6"/><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7"/></svg>`,
  lockLarge: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.6"/><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7"/></svg>`,
  search: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16.2 16.2L20.5 20.5"/></svg>`,
  plus: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M12 5.5v13M5.5 12h13"/></svg>`,
  key: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="12" r="3.6"/><path d="M11.6 12H20M17.2 12v3.2M20 12v2.2"/></svg>`,
  settings: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h9M18.5 7H20M4 12h3.5M12 12h8M4 17h10M19.5 17H20"/><circle cx="15.5" cy="7" r="2"/><circle cx="9.5" cy="12" r="2"/><circle cx="16.5" cy="17" r="2"/></svg>`,
  more: `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5.5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="18.5" r="1.5"/></svg>`,
  x: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  eye: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.6"/></svg>`,
  eyeOff: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.6"/><path d="M4 4l16 16"/></svg>`,
  dice: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="9" cy="9" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="9" r="1.2" fill="currentColor" stroke="none"/><circle cx="9" cy="15" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="15" r="1.2" fill="currentColor" stroke="none"/></svg>`,
  copy: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2.4"/><path d="M15 5.5H6.5A1.5 1.5 0 0 0 5 7v8.5"/></svg>`,
  trash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9.5 7V5h5v2M7 7l1 12h8l1-12"/></svg>`,
  refresh: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4.5V9h-4.5"/></svg>`,
};

let snackTimer = 0;

function showSnack(message: string): void {
  snack.textContent = message;
  snack.hidden = false;
  requestAnimationFrame(() => snack.classList.add("show"));
  window.clearTimeout(snackTimer);
  snackTimer = window.setTimeout(() => {
    snack.classList.remove("show");
    window.setTimeout(() => {
      snack.hidden = true;
    }, 220);
  }, 1900);
}

async function copyText(text: string, label: string): Promise<void> {
  if (!text) {
    showSnack("没有可复制的内容");
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    showSnack(`${label}已复制`);
    window.setTimeout(() => {
      if (!document.hasFocus()) return;
      void navigator.clipboard.writeText("").catch(() => undefined);
    }, 30_000);
  } catch {
    showSnack("复制失败，请手动选择");
  }
}

function filteredEntries(): Entry[] {
  const query = state.query.trim().toLowerCase();
  if (!query) return state.entries;
  return state.entries.filter((entry) =>
    [entry.label, entry.username, entry.note ?? "", entry.domain, entry.host].some((value) =>
      value.toLowerCase().includes(query),
    ),
  );
}

function highlight(text: string, query: string): string {
  const needle = query.trim();
  if (!needle) return esc(text);
  const haystack = text.toLowerCase();
  const target = needle.toLowerCase();
  if (!haystack.includes(target)) return esc(text);
  let out = "";
  let cursor = 0;
  let at = haystack.indexOf(target);
  while (at >= 0) {
    out += esc(text.slice(cursor, at));
    out += `<mark>${esc(text.slice(at, at + target.length))}</mark>`;
    cursor = at + target.length;
    at = haystack.indexOf(target, cursor);
  }
  return out + esc(text.slice(cursor));
}

function rowHtml(entry: Entry, index: number): string {
  // 偏移一位，保证相邻两行不会撞成同一个色块
  const hue = hueOf(entry.label || entry.username || entry.domain, index);
  const initial = initialOf(entry.label, entry.username, entry.domain);
  const recent = index === 0 && entry.lastUsedAt > 0;
  const query = state.query.trim();
  const tip = [entry.label, entry.username, entry.note].filter(Boolean).join(" · ");
  return `
    <div class="row" data-id="${entry.id}" tabindex="0" role="button" aria-label="填入 ${esc(entry.label)}" title="${esc(tip)}">
      <div class="avatar" style="--h:${hue}">${esc(initial)}</div>
      <div class="row-main">
        <div class="row-title">
          <span class="label">${highlight(entry.label, query)}</span>
          ${recent ? '<span class="pill">上次</span>' : ""}
        </div>
        <div class="row-sub"><span class="who">${highlight(entry.username, query)}</span><span class="dot">·</span><span class="time">${relativeTime(entry.lastUsedAt)}</span></div>
      </div>
      <div class="row-tools">
        <button class="icon-btn copy" data-act="copy-pass" data-id="${entry.id}" title="复制密码" aria-label="复制密码">${icons.copy}</button>
        <button class="icon-btn more" data-act="edit" data-id="${entry.id}" title="编辑" aria-label="编辑">${icons.more}</button>
      </div>
    </div>
  `;
}

function emptyHtml(): string {
  if (!state.host) {
    return `
      <div class="empty">
        <div class="empty-icon">${icons.key}</div>
        <h2>这个页面不支持记录</h2>
        <p>打开一个 http 或 https 网站，SiteKey 才能识别站点。</p>
      </div>
    `;
  }
  if (state.query) {
    return `
      <div class="empty">
        <div class="empty-icon">${icons.search}</div>
        <h2>没有匹配的账号</h2>
        <p>试试标签、登录名或备注里的关键词。</p>
      </div>
    `;
  }
  return `
    <div class="empty">
      <div class="empty-icon">${icons.key}</div>
      <h2>还没有这个站点的记录</h2>
      <p>登录一次，SiteKey 会问你要不要保存；也可以现在手动添加。</p>
      <button class="btn primary" data-act="add">添加账号</button>
    </div>
  `;
}

function renderRows(): void {
  const list = document.getElementById("list");
  if (!list) return;
  const items = filteredEntries();
  list.innerHTML = items.length ? items.map(rowHtml).join("") : emptyHtml();

  const count = document.getElementById("count");
  if (count) {
    count.textContent = state.query.trim()
      ? `${items.length} / ${state.entries.length} 条`
      : `${state.entries.length} 条记录`;
  }
}

function renderMain(): void {
  const supported = Boolean(state.host);
  const hue = hueOf(state.domain || "sitekey");
  const initial = initialOf(state.host || "S", "", "S");
  const title = supported ? state.host : "当前页面";

  screen.innerHTML = `
    <header class="topbar">
      <div class="site">
        <div class="tile" style="--h:${hue}">${esc(initial)}</div>
        <div class="site-text">
          <h1 title="${esc(title)}">${esc(title)}</h1>
          <p id="count">${supported ? `${state.entries.length} 条记录` : "这个页面不支持记录"}</p>
        </div>
      </div>
      <button class="icon-btn" data-act="lock" title="锁定保险库" aria-label="锁定保险库">${icons.lock}</button>
    </header>
    ${
      supported
        ? `<div class="searchbar">
             ${icons.search}
             <input id="search" type="text" placeholder="搜索标签或账号" autocomplete="off" spellcheck="false" value="${esc(state.query)}">
             <kbd>/</kbd>
           </div>`
        : ""
    }
    <main class="list" id="list"></main>
    <footer class="bottombar">
      <button data-act="add">${icons.plus}<span>添加</span></button>
      <button data-act="gen">${icons.key}<span>生成</span></button>
      <button data-act="settings">${icons.settings}<span>设置</span></button>
    </footer>
  `;
  renderRows();
}

function renderSetup(): void {
  screen.innerHTML = `
    <div class="hero">
      <div class="logo">${icons.lockLarge}</div>
      <h1>创建主密码</h1>
      <p>只存在你的脑子里。SiteKey 不上传、不托管，也无法帮你找回。</p>
    </div>
    <form class="stack" id="setup-form">
      <input class="field" id="setup-pw" type="password" placeholder="主密码（至少 8 位）" autocomplete="new-password">
      <input class="field" id="setup-pw2" type="password" placeholder="再输一次" autocomplete="new-password">
      <div class="strength" id="strength"><span></span><span></span><span></span><span></span></div>
      <div class="error" id="setup-error" hidden></div>
      <button class="btn primary block" type="submit">创建保险库</button>
      <p class="hint">忘记主密码等于数据无法恢复。建议创建后立即导出一份加密备份。</p>
    </form>
  `;
  const input = document.getElementById("setup-pw") as HTMLInputElement | null;
  setTimeout(() => input?.focus(), 60);
}

function renderLocked(): void {
  screen.innerHTML = `
    <div class="hero">
      <div class="logo">${icons.lockLarge}</div>
      <h1>SiteKey 已锁定</h1>
      <p>输入主密码继续</p>
    </div>
    <form class="stack" id="unlock-form">
      <input class="field" id="unlock-pw" type="password" placeholder="主密码" autocomplete="current-password">
      <div class="error" id="unlock-error" hidden></div>
      <button class="btn primary block" type="submit">解锁</button>
      <p class="hint">密钥只保存在本次浏览器会话的内存里，关闭浏览器即失效。</p>
    </form>
  `;
  const input = document.getElementById("unlock-pw") as HTMLInputElement | null;
  setTimeout(() => input?.focus(), 60);
}

function render(): void {
  if (state.status === "uninitialized") renderSetup();
  else if (state.status === "locked") renderLocked();
  else renderMain();
}

async function refreshEntries(): Promise<void> {
  if (!state.url) {
    state.entries = [];
    return;
  }
  const response = await rpc({ type: "LIST", url: state.url });
  state.entries = (response.entries ?? []) as Entry[];
  if (response.host) state.host = response.host as string;
  if (response.domain) state.domain = response.domain as string;
}

async function boot(): Promise<void> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tabs[0]?.url ?? "";
  state.url = url;
  state.host = hostFromUrl(url);
  state.domain = registrableDomain(state.host);

  try {
    const response = await rpc({ type: "STATUS" });
    state.status = response.status as VaultStatus;
    if (state.status === "unlocked") await refreshEntries();
  } catch {
    state.status = "locked";
  }
  render();
  applyDemoState();
}

/** 演示页用 ?demo=editor|generator 直接展开对应面板 */
function applyDemoState(): void {
  const demo = new URLSearchParams(location.search).get("demo");
  if (!demo || state.status !== "unlocked") return;
  window.setTimeout(() => {
    if (demo === "editor") openEditor(null);
    if (demo === "generator") openGenerator();
  }, 90);
}

function openSheet(html: string): void {
  sheet.innerHTML = html;
  sheet.hidden = false;
  backdrop.hidden = false;
  requestAnimationFrame(() => {
    sheet.classList.add("open");
    backdrop.classList.add("open");
  });
}

function closeSheet(): void {
  sheet.classList.remove("open");
  backdrop.classList.remove("open");
  window.setTimeout(() => {
    if (sheet.classList.contains("open")) return;
    sheet.hidden = true;
    backdrop.hidden = true;
    sheet.innerHTML = "";
  }, 300);
}

function editorSheet(entry: Entry | null, presetPassword = ""): string {
  const scope: MatchScope = entry?.scope ?? "smart";
  const selected = (value: MatchScope) => (scope === value ? "selected" : "");
  const domainLabel = state.domain || "当前站点";

  return `
    <div class="sheet-head">
      <h2>${entry ? "编辑账号" : "添加账号"}</h2>
      <button class="icon-btn" data-act="close-sheet" aria-label="关闭">${icons.x}</button>
    </div>
    <form class="stack" id="entry-form" data-id="${entry?.id ?? ""}" style="padding:0">
      <div class="field-group">
        <label>标签 <span style="font-weight:400;color:var(--text-3)">用来区分同站点多个账号</span></label>
        <input class="field" name="label" maxlength="48" autocomplete="off" placeholder="例如：客户A · 公众号" value="${esc(entry?.label ?? "")}">
      </div>
      <div class="field-group">
        <div class="field-label">
          <span>登录名</span>
          <button type="button" class="mini" data-act="copy-user" title="复制登录名">${icons.copy}</button>
        </div>
        <input class="field" name="username" autocomplete="off" spellcheck="false" placeholder="邮箱 / 手机号 / 用户名" value="${esc(entry?.username ?? "")}">
      </div>
      <div class="field-group">
        <div class="field-label">
          <span>密码</span>
          <button type="button" class="mini" data-act="copy-pass" title="复制密码">${icons.copy}</button>
        </div>
        <div class="pw-wrap">
          <input class="field" name="password" type="password" autocomplete="off" spellcheck="false" value="${esc(entry?.password ?? presetPassword)}">
          <div class="pw-tools">
            <button type="button" class="mini" data-act="toggle-pw" title="显示密码">${icons.eye}</button>
            <button type="button" class="mini" data-act="gen-inline" title="生成密码">${icons.dice}</button>
          </div>
        </div>
      </div>
      <div class="field-group">
        <label>备注</label>
        <input class="field" name="note" maxlength="120" autocomplete="off" placeholder="可选" value="${esc(entry?.note ?? "")}">
      </div>
      <div class="field-group">
        <label>匹配范围</label>
        <select class="field" name="scope">
          <option value="smart" ${selected("smart")}>智能（推荐）</option>
          <option value="host" ${selected("host")}>仅此域名 · ${esc(state.host || "当前域名")}</option>
          <option value="domain" ${selected("domain")}>整个站点 · ${esc(domainLabel)}</option>
          <option value="custom" ${selected("custom")}>自定义规则</option>
        </select>
      </div>
      <div class="field-group" id="pattern-group" ${scope === "custom" ? "" : "hidden"}>
        <label>规则</label>
        <input class="field" name="pattern" autocomplete="off" placeholder="*.example.com" value="${esc(entry?.pattern ?? "")}">
      </div>
      <div class="actions-row">
        ${
          entry
            ? `<button type="button" class="btn danger" data-act="delete">${icons.trash}<span>删除</span></button>`
            : ""
        }
        <button type="submit" class="btn primary">${entry ? "保存" : "添加"}</button>
      </div>
    </form>
  `;
}

function openEditor(entry: Entry | null, presetPassword = ""): void {
  if (!entry && !state.host) {
    showSnack("当前页面不支持记录账号");
    return;
  }
  openSheet(editorSheet(entry, presetPassword));
  const input = sheet.querySelector<HTMLInputElement>('input[name="label"]');
  window.setTimeout(() => input?.focus(), 320);
}

function openGenerator(): void {
  openSheet(`
    <div class="sheet-head">
      <h2>生成密码</h2>
      <button class="icon-btn" data-act="close-sheet" aria-label="关闭">${icons.x}</button>
    </div>
    <div class="gen-output">
      <code id="gen-value">${esc(genValue)}</code>
      <button class="mini" data-act="gen-refresh" title="重新生成">${icons.refresh}</button>
    </div>
    <div class="gen-row">
      <label for="gen-length">长度</label>
      <input id="gen-length" type="range" min="8" max="48" value="${genLength}">
      <output id="gen-len">${genLength}</output>
    </div>
    <div class="switch-row"><span>大写 A-Z</span><button class="switch" role="switch" aria-checked="${genOptions.upper}" data-key="upper"></button></div>
    <div class="switch-row"><span>小写 a-z</span><button class="switch" role="switch" aria-checked="${genOptions.lower}" data-key="lower"></button></div>
    <div class="switch-row"><span>数字 0-9</span><button class="switch" role="switch" aria-checked="${genOptions.digits}" data-key="digits"></button></div>
    <div class="switch-row"><span>符号 !@#</span><button class="switch" role="switch" aria-checked="${genOptions.symbols}" data-key="symbols"></button></div>
    <div class="actions-row">
      <button class="btn" data-act="gen-copy">复制</button>
      <button class="btn primary" data-act="gen-new">用这个密码新建账号</button>
    </div>
  `);
}

let genLength = 20;
let genOptions: GenOptions = { ...DEFAULT_GEN_OPTIONS };
let genValue = generatePassword(genLength, genOptions);

function updateGenValue(): void {
  const value = document.getElementById("gen-value");
  if (value) value.textContent = genValue;
}

function regenerate(): void {
  genValue = generatePassword(genLength, genOptions);
  updateGenValue();
}

async function fillEntry(id: string): Promise<void> {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return;
  try {
    await rpc({ type: "FILL", id });
    entry.lastUsedAt = Date.now();
    entry.useCount += 1;
    showSnack("已填入当前页面");
    window.setTimeout(() => {
      try {
        window.close();
      } catch {
        /* preview mode */
      }
    }, 280);
  } catch (error) {
    if (error instanceof Error && error.message === "LOCKED") {
      state.status = "locked";
      closeSheet();
      render();
      return;
    }
    showSnack(humanError(error));
  }
}

function handleSetup(form: HTMLFormElement): void {
  void (async () => {
    const password = (document.getElementById("setup-pw") as HTMLInputElement).value;
    const confirm = (document.getElementById("setup-pw2") as HTMLInputElement).value;
    const errorBox = document.getElementById("setup-error") as HTMLElement;
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;

    errorBox.hidden = true;
    if (password.length < 8) {
      errorBox.textContent = "主密码至少 8 位";
      errorBox.hidden = false;
      return;
    }
    if (password !== confirm) {
      errorBox.textContent = "两次输入不一致";
      errorBox.hidden = false;
      return;
    }

    submit.disabled = true;
    submit.textContent = "创建中…";
    try {
      await rpc({ type: "SETUP", password });
      state.status = "unlocked";
      await refreshEntries();
      render();
      showSnack("保险库已创建");
    } catch (error) {
      errorBox.textContent = humanError(error);
      errorBox.hidden = false;
    } finally {
      submit.disabled = false;
      submit.textContent = "创建保险库";
    }
  })();
}

function handleUnlock(form: HTMLFormElement): void {
  void (async () => {
    const password = (document.getElementById("unlock-pw") as HTMLInputElement).value;
    const errorBox = document.getElementById("unlock-error") as HTMLElement;
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;

    errorBox.hidden = true;
    submit.disabled = true;
    submit.textContent = "解锁中…";
    try {
      await rpc({ type: "UNLOCK", password });
      state.status = "unlocked";
      await refreshEntries();
      render();
      showSnack("已解锁");
    } catch (error) {
      errorBox.textContent = humanError(error);
      errorBox.hidden = false;
      submit.disabled = false;
      submit.textContent = "解锁";
      (document.getElementById("unlock-pw") as HTMLInputElement | null)?.select();
    }
  })();
}

function handleEntrySubmit(form: HTMLFormElement): void {
  void (async () => {
    const id = form.dataset.id ?? "";
    const data = new FormData(form);
    const username = String(data.get("username") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const label = String(data.get("label") ?? "").trim();
    const note = String(data.get("note") ?? "").trim();
    const scope = (String(data.get("scope") ?? "smart") as MatchScope) || "smart";
    const pattern = String(data.get("pattern") ?? "").trim();

    if (!username || !password) {
      showSnack("登录名和密码不能为空");
      return;
    }
    if (scope === "custom" && !pattern) {
      showSnack("请填写自定义规则，例如 *.example.com");
      return;
    }

    try {
      if (id) {
        const current = state.entries.find((entry) => entry.id === id);
        if (!current) throw new Error("NOT_FOUND");
        await rpc({
          type: "UPDATE",
          entry: {
            ...current,
            label: label || suggestLabel(username, state.domain),
            username,
            password,
            note,
            scope,
            pattern: scope === "custom" ? pattern : undefined,
          },
        });
      } else {
        await rpc({
          type: "SAVE",
          draft: {
            domain: state.domain,
            host: state.host,
            scope,
            pattern: scope === "custom" ? pattern : undefined,
            username,
            password,
            label: label || suggestLabel(username, state.domain),
            note,
          },
        });
      }
      await refreshEntries();
      closeSheet();
      renderMain();
      showSnack(id ? "已保存" : "已添加");
    } catch (error) {
      showSnack(humanError(error));
    }
  })();
}

function handleDelete(button: HTMLButtonElement): void {
  if (button.dataset.armed !== "1") {
    button.dataset.armed = "1";
    button.textContent = "再点一次确认";
    window.setTimeout(() => {
      if (!button.isConnected) return;
      button.dataset.armed = "0";
      button.innerHTML = `${icons.trash}<span>删除</span>`;
    }, 3000);
    return;
  }

  void (async () => {
    const form = document.getElementById("entry-form") as HTMLFormElement | null;
    const id = form?.dataset.id ?? "";
    if (!id) return;
    try {
      await rpc({ type: "DELETE", id });
      await refreshEntries();
      closeSheet();
      renderMain();
      showSnack("已删除");
    } catch (error) {
      showSnack(humanError(error));
    }
  })();
}

function currentFormValue(name: string): string {
  const form = document.getElementById("entry-form") as HTMLFormElement | null;
  const input = form?.elements.namedItem(name) as HTMLInputElement | null;
  return input?.value ?? "";
}

function handleActionClick(event: MouseEvent): void {
  const target = event.target as HTMLElement;

  const toggle = target.closest<HTMLElement>(".switch[data-key]");
  if (toggle) {
    const key = toggle.dataset.key as keyof GenOptions;
    genOptions = { ...genOptions, [key]: !genOptions[key] };
    toggle.setAttribute("aria-checked", String(genOptions[key]));
    regenerate();
    return;
  }

  const actionElement = target.closest<HTMLElement>("[data-act]");
  if (actionElement) {
    const action = actionElement.dataset.act ?? "";
    const id = actionElement.dataset.id ?? "";

    switch (action) {
      case "lock":
        void (async () => {
          await rpc({ type: "LOCK" }).catch(() => undefined);
          state.status = "locked";
          closeSheet();
          render();
          showSnack("已锁定");
        })();
        break;
      case "add":
        openEditor(null);
        break;
      case "gen":
        openGenerator();
        break;
      case "settings":
        chrome.runtime.openOptionsPage();
        break;
      case "edit":
        openEditor(state.entries.find((entry) => entry.id === id) ?? null);
        break;
      case "close-sheet":
        closeSheet();
        break;
      case "toggle-pw": {
        const input = document.querySelector<HTMLInputElement>('#entry-form input[name="password"]');
        if (!input) break;
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        actionElement.innerHTML = show ? icons.eyeOff : icons.eye;
        actionElement.setAttribute("title", show ? "隐藏密码" : "显示密码");
        break;
      }
      case "gen-inline": {
        const input = document.querySelector<HTMLInputElement>('#entry-form input[name="password"]');
        if (!input) break;
        input.value = generatePassword(20, genOptions);
        input.type = "text";
        const toggleButton = document.querySelector<HTMLElement>('[data-act="toggle-pw"]');
        if (toggleButton) toggleButton.innerHTML = icons.eyeOff;
        break;
      }
      case "copy-user":
        void copyText(currentFormValue("username"), "登录名");
        break;
      case "copy-pass": {
        // 行上的复制按钮带 data-id，从内存里的条目取；编辑面板里的按钮没有 id，从表单取
        const row = id ? state.entries.find((entry) => entry.id === id) : null;
        void copyText(row ? row.password : currentFormValue("password"), "密码");
        break;
      }
      case "delete":
        handleDelete(actionElement as HTMLButtonElement);
        break;
      case "gen-refresh":
        regenerate();
        break;
      case "gen-copy":
        void copyText(genValue, "密码");
        break;
      case "gen-new":
        closeSheet();
        window.setTimeout(() => openEditor(null, genValue), 260);
        break;
      default:
        break;
    }
    return;
  }

  const row = target.closest<HTMLElement>(".row[data-id]");
  if (row?.dataset.id) void fillEntry(row.dataset.id);
}

function handleFormSubmit(event: Event): void {
  event.preventDefault();
  const form = event.target as HTMLFormElement;
  if (form.id === "setup-form") handleSetup(form);
  else if (form.id === "unlock-form") handleUnlock(form);
  else if (form.id === "entry-form") handleEntrySubmit(form);
}

function handleFieldInput(event: Event): void {
  const target = event.target as HTMLElement;

  if (target.id === "search") {
    state.query = (target as HTMLInputElement).value;
    renderRows();
    return;
  }

  if (target.id === "setup-pw") {
    const meter = document.getElementById("strength");
    if (meter) meter.className = `strength s${passwordScore((target as HTMLInputElement).value)}`;
    return;
  }

  if (target.id === "gen-length") {
    genLength = Number((target as HTMLInputElement).value);
    const output = document.getElementById("gen-len");
    if (output) output.textContent = String(genLength);
    regenerate();
    return;
  }

  if (target.matches('select[name="scope"]')) {
    const value = (target as HTMLSelectElement).value;
    const group = document.getElementById("pattern-group");
    if (group) group.hidden = value !== "custom";
  }
}

document.addEventListener("click", handleActionClick);
document.addEventListener("submit", handleFormSubmit);
document.addEventListener("input", handleFieldInput);
backdrop.addEventListener("click", closeSheet);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (!sheet.hidden) {
      closeSheet();
      return;
    }
    if (state.query) {
      state.query = "";
      const search = document.getElementById("search") as HTMLInputElement | null;
      if (search) {
        search.value = "";
        search.focus();
      }
      renderRows();
    }
    return;
  }

  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    const rows = Array.from(document.querySelectorAll<HTMLElement>(".row[data-id]"));
    if (!rows.length) return;
    const current =
      event.target instanceof HTMLElement ? event.target.closest<HTMLElement>(".row[data-id]") : null;

    // 搜索框里按 ↓ 直接落到第一条：搜完就想选，不该先按 Tab 绕一圈
    if (!current) {
      if (
        event.key === "ArrowDown" &&
        event.target instanceof HTMLInputElement &&
        event.target.id === "search"
      ) {
        event.preventDefault();
        rows[0]?.focus();
      }
      return;
    }

    const index = rows.indexOf(current);
    if (index < 0) return;
    event.preventDefault();
    const next = event.key === "ArrowDown" ? Math.min(rows.length - 1, index + 1) : Math.max(0, index - 1);
    rows[next]?.focus();
    return;
  }

  if (event.key === "/" && !(event.target instanceof HTMLInputElement)) {
    const search = document.getElementById("search") as HTMLInputElement | null;
    if (search) {
      event.preventDefault();
      search.focus();
    }
    return;
  }

  if (event.key === "Enter" && event.target instanceof HTMLElement) {
    const row = event.target.closest<HTMLElement>(".row[data-id]");
    if (row?.dataset.id) {
      event.preventDefault();
      void fillEntry(row.dataset.id);
      return;
    }
    if (event.target.id === "search") {
      const first = filteredEntries()[0];
      if (first) {
        event.preventDefault();
        void fillEntry(first.id);
      }
    }
  }
});

void boot();
