import "./options.css";
import type { CsvReportSummary } from "../core/csv";
import type { Request, Settings, VaultRecord, VaultStatus } from "../core/types";

const isExtension = typeof chrome !== "undefined" && Boolean(chrome.runtime?.id);

const statusPill = document.getElementById("status") as HTMLElement;
const statusLabel = document.getElementById("status-text") as HTMLElement;
const unlockCard = document.getElementById("unlock-card") as HTMLElement;
const initCard = document.getElementById("init-card") as HTMLElement;
const toast = document.getElementById("toast") as HTMLElement;

let status: VaultStatus = "locked";

const ERRORS: Record<string, string> = {
  BAD_PASSWORD: "主密码不正确",
  WEAK_PASSWORD: "主密码至少 8 位",
  NOT_INITIALIZED: "还没有创建保险库",
  LOCKED: "保险库已锁定，请先解锁",
  BAD_BACKUP: "备份文件无效",
  CSV_MISSING_COLUMNS: "CSV 缺少 url / username / password 列",
  UNKNOWN: "操作失败，请重试",
};

function humanError(error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  return ERRORS[code] ?? "操作失败，请重试";
}

const DEMO_REPORT: CsvReportSummary = {
  total: 63,
  imported: 47,
  duplicates: 4,
  conflicts: 2,
  hostScoped: 6,
  skipped: [
    { reason: "app-only", count: 7 },
    { reason: "internal", count: 2 },
    { reason: "no-username", count: 1 },
  ],
  hosts: [
    { host: "mp.weixin.qq.com", count: 3 },
    { host: "github.com", count: 2 },
    { host: "ecs.console.aliyun.com", count: 2 },
    { host: "appin.site", count: 2 },
    { host: "www.figma.com", count: 1 },
  ],
  samples: [
    { label: "client_a", username: "client_a@brand.com", host: "mp.weixin.qq.com", state: "conflict" },
    { label: "ops", username: "ops@brand.com", host: "ecs.console.aliyun.com", state: "new" },
  ],
};

async function rpc(request: Request): Promise<Record<string, any>> {
  if (!isExtension) {
    if (request.type === "IMPORT_CSV") {
      return request.dryRun
        ? { ok: true, report: DEMO_REPORT }
        : { ok: true, added: DEMO_REPORT.imported, updated: 0, report: DEMO_REPORT };
    }
    return {
      ok: true,
      status: "unlocked",
      settings: { autoLockMinutes: 5, autoCapture: true, showSavePrompt: true },
    };
  }
  const response = await chrome.runtime.sendMessage(request);
  if (!response || response.ok !== true) throw new Error(response?.error ?? "UNKNOWN");
  return response as Record<string, any>;
}

let toastTimer = 0;

function showToast(message: string): void {
  toast.textContent = message;
  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add("show"));
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("show");
    window.setTimeout(() => {
      toast.hidden = true;
    }, 220);
  }, 2600);
}

function setSwitch(id: string, on: boolean): void {
  document.getElementById(id)?.setAttribute("aria-checked", String(on));
}

function applyStatus(next: VaultStatus): void {
  status = next;
  statusPill.dataset.state = next;
  statusLabel.textContent =
    next === "unlocked" ? "已解锁" : next === "locked" ? "已锁定" : "未初始化";
  unlockCard.hidden = next !== "locked";
  initCard.hidden = next !== "uninitialized";

  document.querySelectorAll<HTMLElement>("[data-needs-unlock]").forEach((element) => {
    const disabled = next !== "unlocked";
    if (element instanceof HTMLButtonElement) element.disabled = disabled;
    element.classList.toggle("is-disabled", disabled);
  });
}

async function refreshStatus(): Promise<void> {
  try {
    const response = await rpc({ type: "STATUS" });
    applyStatus(response.status as VaultStatus);
  } catch {
    applyStatus("locked");
  }
}

async function loadSettings(): Promise<void> {
  const response = await rpc({ type: "GET_SETTINGS" });
  const settings = response.settings as Settings;
  const select = document.getElementById("auto-lock") as HTMLSelectElement;
  select.value = String(settings.autoLockMinutes);
  setSwitch("toggle-capture", settings.autoCapture);
  setSwitch("toggle-prompt", settings.showSavePrompt);
}

function bindSwitch(id: string, key: "autoCapture" | "showSavePrompt"): void {
  const element = document.getElementById(id);
  element?.addEventListener("click", () => {
    void (async () => {
      const next = element.getAttribute("aria-checked") !== "true";
      element.setAttribute("aria-checked", String(next));
      const patch: Partial<Settings> =
        key === "autoCapture" ? { autoCapture: next } : { showSavePrompt: next };
      try {
        await rpc({ type: "SET_SETTINGS", settings: patch });
      } catch {
        element.setAttribute("aria-checked", String(!next));
        showToast("保存失败，请重试");
      }
    })();
  });
}

async function exportBackup(): Promise<void> {
  try {
    const response = await rpc({ type: "EXPORT" });
    const record = response.record as VaultRecord;
    const payload = JSON.stringify(
      { app: "sitekey", version: 1, exportedAt: new Date().toISOString(), record },
      null,
      2,
    );
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    anchor.href = url;
    anchor.download = `sitekey-backup-${stamp}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("加密备份已导出");
  } catch (error) {
    showToast(humanError(error));
  }
}

async function importBackup(file: File): Promise<void> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text) as { record?: VaultRecord } & Partial<VaultRecord>;
    const record = (parsed.record ?? parsed) as VaultRecord;
    if (!record?.salt || !record?.blob || record.v !== 1) throw new Error("BAD_BACKUP");
    if (!window.confirm("导入会覆盖当前保险库，确定继续？")) return;
    await rpc({ type: "IMPORT", record });
    await refreshStatus();
    showToast("备份已导入，请重新解锁");
  } catch (error) {
    showToast(humanError(error));
  }
}

async function importCsv(file: File): Promise<void> {
  if (status !== "unlocked") {
    showToast("请先解锁保险库");
    return;
  }
  try {
    const text = await file.text();
    // 第一段只解析：先把「哪些能导、哪些跳过、哪些撞了」摆给用户看
    const response = await rpc({ type: "IMPORT_CSV", text, dryRun: true });
    pendingCsv = { text, report: response.report as CsvReportSummary, name: file.name };
    renderReport();
  } catch (error) {
    showToast(humanError(error));
  }
}

let pendingCsv: { text: string; report: CsvReportSummary; name: string } | null = null;

const SKIP_LABELS: Record<string, string> = {
  "no-url": "没有网址",
  "app-only": "手机 App 内密码",
  internal: "浏览器内部页面",
  "no-username": "缺少登录名",
  "no-password": "缺少密码",
};

function renderReport(): void {
  const panel = document.getElementById("csv-panel") as HTMLElement;
  const summary = document.getElementById("csv-summary") as HTMLElement;
  const domains = document.getElementById("csv-domains") as HTMLElement;
  const samples = document.getElementById("csv-samples") as HTMLElement;
  const confirm = document.getElementById("csv-confirm") as HTMLButtonElement;

  if (!pendingCsv) {
    panel.hidden = true;
    return;
  }

  const { report, name } = pendingCsv;
  const skippedTotal = report.skipped.reduce((sum, item) => sum + item.count, 0);

  const facts: string[] = [`共 ${report.total} 行`, `可导入 ${report.imported} 条`];
  if (report.duplicates) facts.push(`合并重复 ${report.duplicates} 条`);
  if (report.conflicts) facts.push(`密码冲突 ${report.conflicts} 条`);
  if (skippedTotal) facts.push(`跳过 ${skippedTotal} 条`);

  summary.innerHTML = `
    <div class="import-file">${esc(name)}</div>
    <div class="import-facts">${facts.map((fact) => `<span>${esc(fact)}</span>`).join("")}</div>
  `;

  const domainRows = report.hosts
    .map(
      (item) =>
        `<li><span class="mono">${esc(item.host)}</span><span class="count">${item.count}</span></li>`,
    )
    .join("");

  const skipRows = report.skipped
    .map(
      (item) =>
        `<li><span>${esc(SKIP_LABELS[item.reason] ?? item.reason)}</span><span class="count">${item.count}</span></li>`,
    )
    .join("");

  domains.innerHTML = `
    ${domainRows ? `<p class="import-caption">将导入</p><ul class="import-list">${domainRows}</ul>` : ""}
    ${skipRows ? `<p class="import-caption">跳过</p><ul class="import-list import-list-muted">${skipRows}</ul>` : ""}
    ${report.hostScoped ? `<p class="import-note">其中 ${report.hostScoped} 条按「仅此域名」导入：该站点存在多个子域，避免互相覆盖。</p>` : ""}
  `;

  const conflictRows = report.samples
    .filter((sample) => sample.state === "conflict")
    .map(
      (sample) =>
        `<li><span class="mono">${esc(sample.host)}</span><span class="who">${esc(sample.username)}</span></li>`,
    )
    .join("");

  samples.innerHTML = conflictRows
    ? `<div class="import-warn">同一账号在 Chrome 里存了不同密码，已保留第一条，其余跳过。登录失败时请回 Chrome 核对：</div>
       <ul class="import-list import-list-warn">${conflictRows}</ul>`
    : "";

  confirm.textContent = report.imported > 0 ? `确认导入 ${report.imported} 条` : "没有可导入的账号";
  confirm.disabled = report.imported === 0;
  panel.hidden = false;
}

async function confirmCsv(): Promise<void> {
  if (!pendingCsv) return;
  const button = document.getElementById("csv-confirm") as HTMLButtonElement;
  button.disabled = true;
  button.textContent = "导入中…";
  try {
    const response = await rpc({ type: "IMPORT_CSV", text: pendingCsv.text });
    const added = Number(response.added ?? 0);
    const updated = Number(response.updated ?? 0);
    showToast(`导入完成：新增 ${added} 条，更新 ${updated} 条`);
    pendingCsv = null;
    renderReport();
    await refreshStatus();
  } catch (error) {
    showToast(humanError(error));
    button.disabled = false;
    renderReport();
  }
}

function cancelCsv(): void {
  pendingCsv = null;
  renderReport();
  showToast("已取消导入");
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

let clearArmed = false;

function bindClear(): void {
  const button = document.getElementById("clear") as HTMLButtonElement;
  button.addEventListener("click", () => {
    void (async () => {
      if (!clearArmed) {
        clearArmed = true;
        button.textContent = "再点一次确认";
        window.setTimeout(() => {
          if (!clearArmed) return;
          clearArmed = false;
          button.textContent = "清空";
        }, 3000);
        return;
      }
      clearArmed = false;
      button.textContent = "清空";
      try {
        await rpc({ type: "CLEAR" });
        await refreshStatus();
        showToast("保险库已清空");
      } catch (error) {
        showToast(humanError(error));
      }
    })();
  });
}

function bindUnlock(): void {
  const form = document.getElementById("unlock-form") as HTMLFormElement;
  const errorBox = document.getElementById("unlock-error") as HTMLElement;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void (async () => {
      const password = (document.getElementById("unlock-pw") as HTMLInputElement).value;
      errorBox.hidden = true;
      try {
        await rpc({ type: "UNLOCK", password });
        applyStatus("unlocked");
        showToast("已解锁");
      } catch (error) {
        errorBox.textContent = humanError(error);
        errorBox.hidden = false;
      }
    })();
  });
}

function bindPasswordForm(): void {
  const toggle = document.getElementById("toggle-password-form") as HTMLButtonElement;
  const form = document.getElementById("password-form") as HTMLFormElement;

  toggle.addEventListener("click", () => {
    form.hidden = !form.hidden;
    if (!form.hidden) (document.getElementById("current-pw") as HTMLInputElement).focus();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void (async () => {
      const current = (document.getElementById("current-pw") as HTMLInputElement).value;
      const next = (document.getElementById("next-pw") as HTMLInputElement).value;
      if (next.length < 8) {
        showToast("新主密码至少 8 位");
        return;
      }
      try {
        await rpc({ type: "CHANGE_PASSWORD", current, next });
        form.reset();
        form.hidden = true;
        showToast("主密码已更新");
      } catch (error) {
        showToast(humanError(error));
      }
    })();
  });
}

function bindDataActions(): void {
  (document.getElementById("export") as HTMLButtonElement).addEventListener("click", () => {
    void exportBackup();
  });

  const importInput = document.getElementById("import-file") as HTMLInputElement;
  importInput.addEventListener("change", () => {
    const file = importInput.files?.[0];
    if (file) void importBackup(file).finally(() => (importInput.value = ""));
  });

  const csvInput = document.getElementById("csv-file") as HTMLInputElement;
  csvInput.addEventListener("change", () => {
    const file = csvInput.files?.[0];
    if (file) void importCsv(file).finally(() => (csvInput.value = ""));
  });

  (document.getElementById("csv-confirm") as HTMLButtonElement).addEventListener("click", () => {
    void confirmCsv();
  });
  (document.getElementById("csv-cancel") as HTMLButtonElement).addEventListener("click", cancelCsv);
}

async function boot(): Promise<void> {
  if (!isExtension) document.body.classList.add("preview");
  bindUnlock();
  bindPasswordForm();
  bindDataActions();
  bindClear();
  bindSwitch("toggle-capture", "autoCapture");
  bindSwitch("toggle-prompt", "showSavePrompt");

  (document.getElementById("auto-lock") as HTMLSelectElement).addEventListener("change", (event) => {
    void (async () => {
      const minutes = Number((event.target as HTMLSelectElement).value);
      try {
        await rpc({ type: "SET_SETTINGS", settings: { autoLockMinutes: minutes } });
        showToast(`自动锁定：${minutes} 分钟`);
      } catch (error) {
        showToast(humanError(error));
      }
    })();
  });

  (document.getElementById("lock-now") as HTMLButtonElement).addEventListener("click", () => {
    void (async () => {
      await rpc({ type: "LOCK" }).catch(() => undefined);
      await refreshStatus();
      showToast("已锁定");
    })();
  });

  await refreshStatus();
  try {
    await loadSettings();
  } catch {
    /* preview mode */
  }

  // 预览页里加 ?import 就能看到解析报告长什么样（真实扩展里不会触发）
  if (!isExtension && new URLSearchParams(location.search).has("import")) {
    pendingCsv = { text: "", report: DEMO_REPORT, name: "Chrome 密码.csv" };
    renderReport();
  }
}

void boot();
