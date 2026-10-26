#!/usr/bin/env node
/**
 * SiteKey 端到端回归测试
 *
 * 真实 Chromium 加载 dist/ 里的扩展，跑完整用户链路：
 * 建库 → 登录捕获 → 保存气泡 → 填入 → 门禁 → CSV 报告 → 换主密码合并。
 *
 * 用法：
 *   npm run test:e2e                # 自动解析本机浏览器
 *   SITEKEY_BROWSER=/path/to/chrome npm run test:e2e   # 指定浏览器
 *   SITEKEY_E2E_HEADED=1 npm run test:e2e              # 有头调试
 *
 * 浏览器解析顺序：SITEKEY_BROWSER → playwright 自带 → Playwright 缓存 → 系统 Chrome/Chromium/Edge。
 */

import { accessSync, constants, existsSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import { chromium } from "playwright-core";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EXT_DIR = join(ROOT, "dist");
const MASTER = "Test-Master-123!";
const NEW_MASTER = "Other-Master-456!";
const HEADED = process.env.SITEKEY_E2E_HEADED === "1";

/* ------------------------------------------------------------------ */
/* 浏览器解析：不写死任何机器路径                                        */
/* ------------------------------------------------------------------ */

const EXE_NAMES =
  process.platform === "win32"
    ? ["chrome.exe", "Chromium.exe", "Google Chrome for Testing.exe", "msedge.exe", "brave.exe"]
    : ["Chromium", "Google Chrome for Testing", "Google Chrome", "chrome", "chromium", "chromium-browser", "msedge"];

const SKIP_DIR = /(headless|helper|crashpad|swiftshader|resources)/i;

function isExecutable(file) {
  try {
    if (statSync(file).isDirectory()) return false;
    accessSync(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** 在目录下广度优先找主程序（排除 headless shell / helper 等附属二进制） */
function findExecutable(root, maxDepth = 7) {
  const queue = [{ dir: root, level: 0 }];
  while (queue.length) {
    const { dir, level } = queue.shift();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isFile() && EXE_NAMES.includes(entry.name) && !SKIP_DIR.test(full) && isExecutable(full)) {
        return full;
      }
    }
    if (level >= maxDepth) continue;
    for (const entry of entries) {
      if (!entry.isDirectory() || SKIP_DIR.test(entry.name)) continue;
      queue.push({ dir: join(dir, entry.name), level: level + 1 });
    }
  }
  return null;
}

function playwrightCacheRoots() {
  const home = homedir();
  const roots = [];
  if (process.env.PLAYWRIGHT_BROWSERS_PATH && process.env.PLAYWRIGHT_BROWSERS_PATH !== "0") {
    roots.push(process.env.PLAYWRIGHT_BROWSERS_PATH);
  }
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    roots.push(join(process.env.LOCALAPPDATA, "ms-playwright"));
  }
  roots.push(join(home, "Library/Caches/ms-playwright"));
  roots.push(join(home, ".cache/ms-playwright"));
  return [...new Set(roots)];
}

function systemBrowserPaths() {
  if (process.platform === "darwin") {
    const apps = [
      "Google Chrome",
      "Chromium",
      "Google Chrome for Testing",
      "Microsoft Edge",
      "Brave Browser",
    ];
    return apps.flatMap((app) => [
      `/Applications/${app}.app/Contents/MacOS/${app}`,
      join(homedir(), `Applications/${app}.app/Contents/MacOS/${app}`),
    ]);
  }
  if (process.platform === "win32") {
    const bases = [process.env["PROGRAMFILES"], process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA].filter(Boolean);
    return bases.flatMap((base) => [
      join(base, "Google/Chrome/Application/chrome.exe"),
      join(base, "Chromium/Application/chrome.exe"),
      join(base, "Microsoft/Edge/Application/msedge.exe"),
    ]);
  }
  return [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge",
    "/snap/bin/chromium",
  ];
}

function resolveBrowser() {
  const explicit = process.env.SITEKEY_BROWSER;
  if (explicit) {
    if (!isExecutable(explicit)) {
      throw new Error(`SITEKEY_BROWSER 指向的文件不可执行：${explicit}`);
    }
    return { path: explicit, source: "SITEKEY_BROWSER" };
  }

  // playwright-core 自带的解析（仅在其已下载浏览器时有效）
  try {
    const bundled = chromium.executablePath();
    if (bundled && !/headless/i.test(bundled) && isExecutable(bundled)) {
      return { path: bundled, source: "playwright" };
    }
  } catch {
    /* 未下载浏览器，继续往下降级 */
  }

  // Playwright 缓存里的完整 Chromium 构建（按版本号从新到旧）
  for (const root of playwrightCacheRoots()) {
    let builds;
    try {
      builds = readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && /^chromium-\d+$/.test(entry.name))
        .map((entry) => entry.name)
        .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
    } catch {
      continue;
    }
    for (const build of builds) {
      const found = findExecutable(join(root, build));
      if (found) return { path: found, source: `cache:${build}` };
    }
  }

  // 系统安装的浏览器
  for (const candidate of systemBrowserPaths()) {
    if (isExecutable(candidate)) return { path: candidate, source: "system" };
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* 测试站点                                                            */
/* ------------------------------------------------------------------ */

const page = (body) =>
  `<!doctype html><html><head><meta charset="utf-8"><title>Test</title></head><body style="font:16px sans-serif;padding:24px">${body}</body></html>`;

const routes = {
  "/login": page(`<h1>登录</h1>
    <form id="f">
      <input id="u" name="username" type="text" autocomplete="username" placeholder="账号" style="display:block;margin:6px 0;width:240px;height:28px">
      <input id="p" name="password" type="password" autocomplete="current-password" placeholder="密码" style="display:block;margin:6px 0;width:240px;height:28px">
      <button id="go" type="submit">登录</button>
    </form>
    <script>document.getElementById('f').addEventListener('submit',(e)=>{e.preventDefault();document.body.dataset.logged='1';});</script>`),
  "/plain": page(`<h1>没有登录框</h1><input id="q" type="text" placeholder="随便一个输入框">`),
  "/captcha": page(`<h1>带验证码登录</h1>
    <form id="f">
      <input id="u" name="username" type="text" autocomplete="username" placeholder="账号" style="display:block;margin:6px 0;width:240px;height:28px">
      <input id="p" name="password" type="password" autocomplete="current-password" placeholder="密码" style="display:block;margin:6px 0;width:240px;height:28px">
      <input id="c" name="captcha" type="text" placeholder="验证码" maxlength="6" style="display:block;margin:6px 0;width:240px;height:28px">
      <button id="go" type="submit">登录</button>
    </form>
    <script>document.getElementById('f').addEventListener('submit',(e)=>{e.preventDefault();});</script>`),
  "/signup": page(`<h1>注册</h1>
    <form id="f">
      <input id="u" name="username" type="text" placeholder="账号" style="display:block;margin:6px 0;width:240px;height:28px">
      <input id="p" name="password" type="password" placeholder="密码" style="display:block;margin:6px 0;width:240px;height:28px">
      <input id="p2" name="confirm" type="password" placeholder="确认密码" style="display:block;margin:6px 0;width:240px;height:28px">
      <button id="go" type="submit">注册</button>
    </form>
    <script>document.getElementById('f').addEventListener('submit',(e)=>{e.preventDefault();});</script>`),
};

/* ------------------------------------------------------------------ */
/* 断言与汇总                                                          */
/* ------------------------------------------------------------------ */

const results = [];

async function step(name, fn) {
  const started = Date.now();
  try {
    const detail = await fn();
    const ms = Date.now() - started;
    results.push({ name, ok: true, detail: detail ?? "", ms });
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""} (${ms}ms)`);
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    const ms = Date.now() - started;
    results.push({ name, ok: false, detail: message, ms });
    console.log(`FAIL  ${name} — ${message} (${ms}ms)`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/* ------------------------------------------------------------------ */
/* 主流程                                                              */
/* ------------------------------------------------------------------ */

let server;
let context;
let profileDir;
const consoleErrors = [];

async function main() {
  if (!existsSync(join(EXT_DIR, "manifest.json"))) {
    console.error(`找不到 ${EXT_DIR}/manifest.json，请先执行 npm run build`);
    process.exit(1);
  }

  const browser = resolveBrowser();
  if (!browser) {
    console.error(
      [
        "找不到可用的 Chromium / Chrome。任选一种方式：",
        "  1) npx playwright install chromium",
        "  2) SITEKEY_BROWSER=\"/path/to/Chrome\" npm run test:e2e",
        "  3) 安装 Google Chrome 后重试",
      ].join("\n"),
    );
    process.exit(1);
  }
  console.log(`浏览器：${browser.source} → ${browser.path}`);
  console.log(`扩展目录：${EXT_DIR}${HEADED ? "（有头）" : "（无头）"}\n`);

  server = http.createServer((req, res) => {
    const path = (req.url || "/").split("?")[0];
    const body = routes[path];
    if (!body) {
      res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
      res.end("not found");
      return;
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(body);
  });
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const base = `http://127.0.0.1:${server.address().port}`;

  profileDir = mkdtempSync(join(tmpdir(), "sitekey-e2e-"));
  const args = [
    `--disable-extensions-except=${EXT_DIR}`,
    `--load-extension=${EXT_DIR}`,
    "--no-first-run",
    "--no-default-browser-check",
  ];
  if (typeof process.getuid === "function" && process.getuid() === 0) args.push("--no-sandbox");

  context = await chromium.launchPersistentContext(profileDir, {
    executablePath: browser.path,
    headless: !HEADED,
    args,
  });

  let sw = context.serviceWorkers()[0];
  if (!sw) sw = await context.waitForEvent("serviceworker", { timeout: 20000 });
  const extId = new URL(sw.url()).host;

  // 扩展页作为 RPC 驱动端点
  const ext = await context.newPage();
  ext.on("pageerror", (e) => consoleErrors.push(`[ext pageerror] ${e.message}`));
  ext.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(`[ext console] ${m.text()}`);
  });
  await ext.goto(`chrome-extension://${extId}/popup.html`);

  const rpc = (message) => ext.evaluate((msg) => chrome.runtime.sendMessage(msg), message);
  const tabsQuery = (pattern) =>
    ext.evaluate(async (p) => {
      const tabs = await chrome.tabs.query({ url: p });
      return tabs.map((t) => t.id);
    }, pattern);

  const fillWithRetry = async (pageRef, message) => {
    let response;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      response = await rpc(message);
      if (response && response.error === "NO_CONTENT_SCRIPT") {
        await pageRef.waitForTimeout(500);
        continue;
      }
      break;
    }
    return response;
  };

  // ---- T1 扩展加载 ----
  await step("T1 扩展加载 / service worker 就绪", async () => {
    assert(sw.url().includes("/background.js"), `service worker URL 异常: ${sw.url()}`);
    return `ID ${extId}`;
  });

  // ---- T2 初始状态 ----
  await step("T2 初始状态为未初始化", async () => {
    const r = await rpc({ type: "STATUS" });
    assert(r && r.ok, `STATUS 失败: ${JSON.stringify(r)}`);
    assert(r.status === "uninitialized", `期望 uninitialized，实际 ${r.status}`);
    return r.status;
  });

  // ---- T3 创建主密码 ----
  await step("T3 创建主密码并进入解锁态", async () => {
    const weak = await rpc({ type: "SETUP", password: "123" });
    assert(weak && weak.ok === false && weak.error === "WEAK_PASSWORD", `弱密码未被拒绝: ${JSON.stringify(weak)}`);
    const r = await rpc({ type: "SETUP", password: MASTER });
    assert(r && r.ok, `SETUP 失败: ${JSON.stringify(r)}`);
    const twice = await rpc({ type: "SETUP", password: MASTER });
    assert(
      twice && twice.ok === false && twice.error === "ALREADY_INITIALIZED",
      `重复初始化未拒绝: ${JSON.stringify(twice)}`,
    );
    const s = await rpc({ type: "STATUS" });
    assert(s.status === "unlocked", `期望 unlocked，实际 ${s.status}`);
    return s.status;
  });

  // ---- T4 弹窗渲染 ----
  await step("T4 弹窗页面可渲染", async () => {
    await ext.reload();
    await ext.waitForFunction(
      () => {
        const screen = document.getElementById("screen");
        return screen && screen.childElementCount > 0;
      },
      null,
      { timeout: 8000 },
    );
    const count = await ext.evaluate(() => document.getElementById("screen").childElementCount);
    return `#screen 子节点 ${count}`;
  });

  // ---- T5 手动保存账号 ----
  await step("T5 手动保存账号并可按站点列出", async () => {
    const r = await rpc({
      type: "SAVE",
      draft: {
        domain: "127.0.0.1",
        host: "127.0.0.1",
        scope: "host",
        username: "manual@example.com",
        password: "ManualPass!1",
        label: "手动账号",
      },
    });
    assert(r && r.ok, `SAVE 失败: ${JSON.stringify(r)}`);
    assert(r.created === true, `期望 created=true，实际 ${r.created}`);
    const list = await rpc({ type: "LIST", url: `${base}/login` });
    assert(list && list.ok, `LIST 失败: ${JSON.stringify(list)}`);
    assert(list.entries.length === 1, `期望 1 条，实际 ${list.entries.length}`);
    assert(list.entries[0].label === "手动账号", `标签错误: ${list.entries[0].label}`);
    return list.entries[0].label;
  });

  // ---- T6 内容脚本捕获 + 保存气泡 ----
  const login = await context.newPage();
  login.on("pageerror", (e) => consoleErrors.push(`[login pageerror] ${e.message}`));
  login.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(`[login console] ${m.text()}`);
  });

  await step("T6 登录提交后弹出保存气泡并成功保存", async () => {
    await login.goto(`${base}/login`);
    await login.waitForLoadState("load");
    await login.waitForTimeout(700);
    await login.fill("#u", "alice");
    await login.fill("#p", "AlicePass!1");
    await login.click("#go");
    await login.waitForFunction(() => Boolean(document.getElementById("sitekey-toast-host")), null, {
      timeout: 8000,
    });
    const text = await login.evaluate(() => {
      const host = document.getElementById("sitekey-toast-host");
      return host.shadowRoot.textContent.replace(/\s+/g, " ").trim();
    });
    assert(text.includes("保存这个登录？"), `气泡文案异常: ${text.slice(0, 80)}`);
    await login.evaluate(() => {
      const host = document.getElementById("sitekey-toast-host");
      host.shadowRoot.querySelector('[data-action="save"]').click();
    });
    await login.waitForFunction(
      () => {
        const host = document.getElementById("sitekey-toast-host");
        return Boolean(host && host.shadowRoot && host.shadowRoot.textContent.includes("已保存"));
      },
      null,
      { timeout: 8000 },
    );
    const list = await rpc({ type: "LIST", url: `${base}/login` });
    const alice = list.entries.find((e) => e.username === "alice");
    assert(alice, "保存后没有找到 alice 记录");
    assert(alice.password === "AlicePass!1", "保存的密码不一致");
    return `共 ${list.entries.length} 条，标签「${alice.label}」`;
  });

  // ---- T7 验证码页：仍可捕获，且验证码不会成为账号 ----
  await step("T7 验证码页可捕获且验证码不成为账号", async () => {
    await login.goto(`${base}/captcha`);
    await login.waitForLoadState("load");
    await login.waitForTimeout(700);
    await login.fill("#u", "captcha-user");
    await login.fill("#p", "CaptchaPass!1");
    await login.fill("#c", "835201");
    await login.click("#go");
    await login.waitForFunction(() => Boolean(document.getElementById("sitekey-toast-host")), null, {
      timeout: 8000,
    });
    const shown = await login.evaluate(() => {
      const host = document.getElementById("sitekey-toast-host");
      return host.shadowRoot.querySelector(".user span").textContent.trim();
    });
    assert(shown === "captcha-user", `气泡里的账号应是 captcha-user，实际「${shown}」`);
    await login.evaluate(() => {
      const host = document.getElementById("sitekey-toast-host");
      host.shadowRoot.querySelector('[data-action="save"]').click();
    });
    await login.waitForFunction(
      () => {
        const host = document.getElementById("sitekey-toast-host");
        return Boolean(host && host.shadowRoot && host.shadowRoot.textContent.includes("已保存"));
      },
      null,
      { timeout: 8000 },
    );
    const list = await rpc({ type: "LIST", url: `${base}/captcha` });
    const captured = list.entries.find((e) => e.username === "captcha-user");
    assert(captured, "验证码页没有保存成功");
    assert(captured.password === "CaptchaPass!1", "验证码页密码不一致");
    assert(!list.entries.some((e) => e.username === "835201"), "验证码被当成了账号");
    return `账号 ${captured.username}，验证码未入库`;
  });

  // ---- T8 注册页：一票否决，不弹气泡 ----
  await step("T8 注册页不弹保存气泡", async () => {
    await login.goto(`${base}/signup`);
    await login.waitForLoadState("load");
    await login.waitForTimeout(700);
    await login.fill("#u", "signup-user");
    await login.fill("#p", "SignupPass!1");
    await login.fill("#p2", "SignupPass!1");
    await login.click("#go");
    await login.waitForTimeout(3500);
    const exists = await login.evaluate(() => Boolean(document.getElementById("sitekey-toast-host")));
    assert(!exists, "注册页错误地弹出了保存气泡");
    return "未弹气泡";
  });

  // ---- T9 填入 ----
  await step("T9 从保险库填入账号密码", async () => {
    await login.goto(`${base}/login`);
    await login.waitForLoadState("load");
    await login.waitForTimeout(700);
    const list = await rpc({ type: "LIST", url: `${base}/login` });
    const alice = list.entries.find((e) => e.username === "alice");
    assert(alice, "找不到 alice");
    const tabIds = await tabsQuery(`${base}/login*`);
    assert(tabIds.length > 0, "找不到登录页 tab");
    const r = await fillWithRetry(login, { type: "FILL", id: alice.id, tabId: tabIds[tabIds.length - 1] });
    assert(r && r.ok, `FILL 失败: ${JSON.stringify(r)}`);
    const values = await login.evaluate(() => ({
      u: document.getElementById("u").value,
      p: document.getElementById("p").value,
    }));
    assert(values.u === "alice", `用户名未填入: ${values.u}`);
    assert(values.p === "AlicePass!1", `密码未填入: ${values.p}`);
    return "用户名与密码均已填入";
  });

  // ---- T10 无密码框页面填入应失败 ----
  await step("T10 无登录框页面填入应返回 NO_PASSWORD_FIELD", async () => {
    const plain = await context.newPage();
    await plain.goto(`${base}/plain`);
    await plain.waitForLoadState("load");
    await plain.waitForTimeout(700);
    const list = await rpc({ type: "LIST", url: `${base}/login` });
    const alice = list.entries.find((e) => e.username === "alice");
    const tabIds = await tabsQuery(`${base}/plain*`);
    assert(tabIds.length > 0, "找不到 plain 页 tab");
    const r = await fillWithRetry(plain, { type: "FILL", id: alice.id, tabId: tabIds[tabIds.length - 1] });
    assert(
      r && r.ok === false && r.error === "NO_PASSWORD_FIELD",
      `期望 NO_PASSWORD_FIELD，实际 ${JSON.stringify(r)}`,
    );
    await plain.close();
    return r.error;
  });

  // ---- T11 锁定 / 错误密码 / 解锁 ----
  await step("T11 锁定后拒绝访问，错误密码解锁失败，正确密码恢复", async () => {
    await rpc({ type: "LOCK" });
    let s = await rpc({ type: "STATUS" });
    assert(s.status === "locked", `期望 locked，实际 ${s.status}`);
    const denied = await rpc({ type: "LIST", url: `${base}/login` });
    assert(
      denied && denied.ok === false && denied.error === "LOCKED",
      `锁定后 LIST 未被拒绝: ${JSON.stringify(denied)}`,
    );
    const wrong = await rpc({ type: "UNLOCK", password: "Wrong-Password-9" });
    assert(
      wrong && wrong.ok === false && wrong.error === "BAD_PASSWORD",
      `错误密码未被拒绝: ${JSON.stringify(wrong)}`,
    );
    const good = await rpc({ type: "UNLOCK", password: MASTER });
    assert(good && good.ok, `解锁失败: ${JSON.stringify(good)}`);
    s = await rpc({ type: "STATUS" });
    assert(s.status === "unlocked", `期望 unlocked，实际 ${s.status}`);
    return "locked → BAD_PASSWORD → unlocked";
  });

  // ---- T12 CSV 分类报告 + 导入 ----
  await step("T12 Chrome CSV 先出分类报告，确认后才写库", async () => {
    const csv = [
      "name,url,username,password,note",
      "客户A 公众号,https://mp.weixin.qq.com/,alice@example.com,PassA1,note-a",
      "客户A 公众号重复,https://mp.weixin.qq.com/,alice@example.com,PassA1,",
      "App 密码,android://abc==,bob,PassB1,",
      "冲突行,https://mp.weixin.qq.com/,alice@example.com,PassA2,",
    ].join("\n");
    const dry = await rpc({ type: "IMPORT_CSV", text: csv, dryRun: true });
    assert(dry && dry.ok, `dryRun 失败: ${JSON.stringify(dry)}`);
    const rp = dry.report;
    assert(rp.total === 4, `total 期望 4，实际 ${rp.total}`);
    assert(rp.imported === 1, `imported 期望 1，实际 ${rp.imported}`);
    assert(rp.duplicates === 1, `duplicates 期望 1，实际 ${rp.duplicates}`);
    assert(rp.conflicts === 1, `conflicts 期望 1，实际 ${rp.conflicts}`);
    assert(
      rp.skipped.some((s) => s.reason === "app-only" && s.count === 1),
      `app-only 跳过计数异常: ${JSON.stringify(rp.skipped)}`,
    );
    const real = await rpc({ type: "IMPORT_CSV", text: csv });
    assert(real && real.ok, `导入失败: ${JSON.stringify(real)}`);
    assert(real.added === 1 && real.updated === 0, `导入计数异常: added=${real.added} updated=${real.updated}`);
    const list = await rpc({ type: "LIST", url: "https://mp.weixin.qq.com/" });
    const imported = list.entries.find((e) => e.username === "alice@example.com");
    assert(imported, "CSV 记录未入库");
    assert(imported.password === "PassA1", "冲突时未保留第一条密码");
    return "total 4 / imported 1 / dup 1 / conflict 1 / app 跳过 1";
  });

  // ---- T13 加密备份 + 换主密码合并 ----
  await step("T13 导出加密备份，换主密码后仍能合并且幂等", async () => {
    const exported = await rpc({ type: "EXPORT" });
    assert(exported && exported.ok && exported.record, `EXPORT 失败: ${JSON.stringify(exported)}`);
    const record = exported.record;

    const cleared = await rpc({ type: "CLEAR" });
    assert(cleared && cleared.ok, `CLEAR 失败: ${JSON.stringify(cleared)}`);
    let s = await rpc({ type: "STATUS" });
    assert(s.status === "uninitialized", `清空后期望 uninitialized，实际 ${s.status}`);

    const setup2 = await rpc({ type: "SETUP", password: NEW_MASTER });
    assert(setup2 && setup2.ok, `新库 SETUP 失败: ${JSON.stringify(setup2)}`);
    const localSave = await rpc({
      type: "SAVE",
      draft: {
        domain: "local.test",
        host: "local.test",
        scope: "host",
        username: "local@test",
        password: "LocalPass!1",
        label: "本机账号",
      },
    });
    assert(localSave && localSave.ok, `本机 SAVE 失败: ${JSON.stringify(localSave)}`);

    const wrong = await rpc({ type: "IMPORT", record, backupPassword: "Not-The-Backup-Password" });
    assert(
      wrong && wrong.ok === false && wrong.error === "BAD_BACKUP_PASSWORD",
      `错误备份密码未被拒绝: ${JSON.stringify(wrong)}`,
    );

    const merged = await rpc({ type: "IMPORT", record, backupPassword: MASTER });
    assert(merged && merged.ok, `IMPORT 失败: ${JSON.stringify(merged)}`);
    assert(merged.mode === "merged", `期望 merged，实际 ${merged.mode}`);
    assert(merged.added === 4, `added 期望 4，实际 ${merged.added}`);
    assert(merged.total === 5, `total 期望 5，实际 ${merged.total}`);

    const list = await rpc({ type: "LIST", url: `${base}/login` });
    assert(list.entries.length === 3, `登录站期望 3 条，实际 ${list.entries.length}`);
    const alice = list.entries.find((e) => e.username === "alice");
    assert(alice && alice.password === "AlicePass!1", "合并后 alice 密码丢失");

    const again = await rpc({ type: "IMPORT", record, backupPassword: MASTER });
    assert(again && again.ok, `二次导入失败: ${JSON.stringify(again)}`);
    assert(again.added === 0 && again.updated === 0, `二次导入不幂等: added=${again.added} updated=${again.updated}`);
    return "merged added 4 / total 5 / 二次导入 +0";
  });

  // ---- T14 设置页烟测 ----
  await step("T14 设置页可渲染且状态正确", async () => {
    const options = await context.newPage();
    options.on("pageerror", (e) => consoleErrors.push(`[options pageerror] ${e.message}`));
    await options.goto(`chrome-extension://${extId}/options.html`);
    await options.waitForFunction(
      () => document.getElementById("status") && document.getElementById("status").dataset.state === "unlocked",
      null,
      { timeout: 8000 },
    );
    const state = await options.evaluate(() => document.getElementById("status").dataset.state);
    const hasSections = await options.evaluate(() => document.querySelectorAll("section.card").length);
    assert(hasSections >= 4, `设置页分区过少: ${hasSections}`);
    await options.close();
    return `state=${state}, ${hasSections} 个分区`;
  });

  // ---- T15 无未捕获脚本错误 ----
  await step("T15 页面与扩展无未捕获脚本错误", async () => {
    const relevant = consoleErrors.filter((line) => !/favicon|net::ERR_|Failed to load resource/i.test(line));
    assert(relevant.length === 0, relevant.slice(0, 5).join(" | "));
    return `${consoleErrors.length} 条日志，0 条致命`;
  });
}

/* ------------------------------------------------------------------ */

try {
  await main();
} catch (error) {
  console.error("HARNESS_ERROR:", error && error.stack ? error.stack : error);
  results.push({ name: "harness", ok: false, detail: String(error), ms: 0 });
} finally {
  if (context) await context.close().catch(() => undefined);
  if (server) await new Promise((done) => server.close(done));
  if (profileDir) rmSync(profileDir, { recursive: true, force: true });
}

const failed = results.filter((item) => !item.ok);
const totalMs = results.reduce((sum, item) => sum + item.ms, 0);

console.log("\n================ 汇总 ================");
console.log(`总计 ${results.length} 项，通过 ${results.length - failed.length}，失败 ${failed.length}，耗时 ${(totalMs / 1000).toFixed(1)}s`);
if (failed.length) {
  console.log("失败项：");
  for (const item of failed) console.log(`- ${item.name}: ${item.detail}`);
}
process.exit(failed.length ? 1 : 0);
