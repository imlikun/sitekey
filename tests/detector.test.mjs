import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import esbuild from "esbuild";
import { JSDOM } from "jsdom";

/**
 * 「绝不误填」的门禁测试。
 * 自动保存和快捷键填充走的是同一套判定，所以这里同时验 qualifyPassword 和 findFillTarget：
 * 支付、注册、搜索、纯验证码这些页面必须一个都填不进去。
 */

const dir = await mkdtemp(join(tmpdir(), "sitekey-detector-"));
const outfile = join(dir, "detector.mjs");
await esbuild.build({
  entryPoints: ["src/content/detector.ts"],
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  outfile,
  logLevel: "silent",
});

const dom = new JSDOM('<!doctype html><html><head><title>登录</title></head><body></body></html>', {
  url: "https://mp.weixin.qq.com/login",
});
const { window } = dom;

// jsdom 不做布局，getBoundingClientRect 全是 0，会让可见性判断把所有元素当成隐藏。
// 这里统一给一个正尺寸，模拟元素真实渲染出来的样子。
window.HTMLElement.prototype.getBoundingClientRect = function () {
  return { width: 220, height: 34, top: 0, left: 0, right: 220, bottom: 34, x: 0, y: 0 };
};

globalThis.window = window;
globalThis.document = window.document;
globalThis.location = window.location;
globalThis.getComputedStyle = window.getComputedStyle.bind(window);
globalThis.Event = window.Event;

const D = await import(pathToFileURL(outfile).href);

function mount(html) {
  document.body.innerHTML = html;
}

function passwordOf(selector) {
  const input = document.querySelector(selector);
  assert.ok(input, `找不到 ${selector}`);
  return input;
}

// 1) 正常登录表单：用户名 + 密码 + 登录按钮
mount(`
  <form id="f">
    <input name="username" type="text" placeholder="邮箱">
    <input name="password" type="password" placeholder="密码">
    <button type="submit">登录</button>
  </form>
`);
assert.ok(D.qualifyPassword(passwordOf("#f input[type=password]")), "正常登录表单应该被识别");

// 2) 支付页：卡号 + 支付密码
mount(`
  <form id="f">
    <input name="cardno" type="text" placeholder="卡号">
    <input name="paypwd" type="password" placeholder="支付密码">
    <button type="button">确认支付</button>
  </form>
`);
assert.equal(D.qualifyPassword(passwordOf("#f input[type=password]")), null, "支付页不能填");
assert.equal(D.findFillTarget(), null, "支付页按快捷键也不能填");

// 3) 注册页：两遍密码 + 注册按钮
mount(`
  <form id="f">
    <input name="email" type="email" placeholder="邮箱">
    <input name="password" type="password" placeholder="设置密码">
    <input name="password_confirm" type="password" placeholder="确认密码">
    <button type="submit">注册</button>
  </form>
`);
assert.equal(D.qualifyPassword(passwordOf("#f input[type=password]")), null, "注册页不能填");

// 4) 搜索表单：name="q" 是最常见的搜索框写法，不能被当成账号输入框
mount(`
  <form id="f">
    <input name="q" type="text" placeholder="搜索">
    <input name="password" type="password" placeholder="密码">
    <button type="submit">搜索</button>
  </form>
`);
assert.equal(D.qualifyPassword(passwordOf("#f input[type=password]")), null, "name=q 的搜索框不能被当成账号");

// 5) 靠中文 placeholder 认出来的搜索框
mount(`
  <form id="f">
    <input name="kw" type="text" placeholder="搜索内容">
    <input name="password" type="password" placeholder="密码">
    <button type="submit">提交</button>
  </form>
`);
assert.equal(D.qualifyPassword(passwordOf("#f input[type=password]")), null, "中文搜索框也不能被当成账号");

// 6) 带验证码的登录页：密码框本身仍然该填
mount(`
  <form id="f">
    <input name="account" type="text" placeholder="账号">
    <input name="password" type="password" placeholder="密码">
    <input name="verify_code" type="text" placeholder="验证码" maxlength="6">
    <button type="submit">登录</button>
  </form>
`);
const otpForm = D.qualifyPassword(passwordOf("#f input[type=password]"));
assert.ok(otpForm, "带验证码的登录页仍然要能填密码");
assert.equal(otpForm.username.name, "account", "账号框要认对，不能认成验证码框");

// 7) 登录页的快捷键填充要能选中正确表单
mount(`
  <form id="f">
    <input name="login_name" type="text" placeholder="账号">
    <input name="login_pwd" type="password" placeholder="密码">
    <button type="submit">登录</button>
  </form>
`);
const target = D.findFillTarget();
assert.ok(target, "登录页按快捷键应该能找到目标");
assert.equal(target.password.name, "login_pwd");

// 8) 只有密码框、没有账号框的自由输入（比如改密页）
mount(`
  <form id="f">
    <input name="new_password" type="password" placeholder="新密码">
    <button type="submit">保存</button>
  </form>
`);
assert.equal(D.findFillTarget(), null, "孤立密码框不能填");

console.log("detector: 门禁 9 组断言全部通过");
