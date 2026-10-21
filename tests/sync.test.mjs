import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import esbuild from "esbuild";

const dir = await mkdtemp(join(tmpdir(), "sitekey-sync-"));
const outfile = join(dir, "vault.mjs");
await esbuild.build({
  entryPoints: ["src/core/vault.ts"],
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  outfile,
  logLevel: "silent",
});

function makeArea() {
  const data = new Map();
  return {
    async get(key) {
      if (typeof key === "string") return data.has(key) ? { [key]: data.get(key) } : {};
      if (Array.isArray(key)) {
        const out = {};
        for (const item of key) if (data.has(item)) out[item] = data.get(item);
        return out;
      }
      return Object.fromEntries(data);
    },
    async set(obj) {
      for (const [key, value] of Object.entries(obj)) data.set(key, value);
    },
    async remove(key) {
      for (const item of Array.isArray(key) ? key : [key]) data.delete(item);
    },
    async clear() {
      data.clear();
    },
  };
}

const devices = {
  a: { local: makeArea(), session: makeArea() },
  b: { local: makeArea(), session: makeArea() },
  c: { local: makeArea(), session: makeArea() },
};
let active = devices.a;

globalThis.chrome = {
  storage: {
    get local() {
      return active.local;
    },
    get session() {
      return active.session;
    },
  },
};

const url = pathToFileURL(outfile).href;
const A = await import(`${url}?dev=a`);
const B = await import(`${url}?dev=b`);
const C = await import(`${url}?dev=c`);

const PWD = "kun-test-2026";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const draft = (username, password, label) => ({
  domain: "qq.com",
  host: "mp.weixin.qq.com",
  scope: "smart",
  username,
  password,
  label,
});

// Mac：建库 + 两个公众号账号
active = devices.a;
await A.setup(PWD);
await A.saveDraft(draft("client_a@brand.com", "passA", "客户A · 公众号"));
await sleep(5);
await A.saveDraft(draft("client_b@brand.com", "passB", "客户B · 服务号"));
const recA = await A.exportRecord();
assert.equal((await A.listForHost("mp.weixin.qq.com")).length, 2);

// Windows：自己建了库，也加了一个账号
active = devices.b;
await B.setup(PWD);
await B.saveDraft(draft("ops@brand.com", "passC", "运营号"));
assert.equal((await B.listForHost("mp.weixin.qq.com")).length, 1);

// 两库 salt 不同，要输 Mac 那台的密码
await assert.rejects(() => B.importRecord(recA, "wrong-password"), /BAD_BACKUP_PASSWORD/);
const merged = await B.importRecord(recA, PWD);
assert.equal(merged.mode, "merged");
assert.equal(merged.added, 2);
assert.equal(merged.total, 3, "Windows 上应该有 3 个账号");

// Mac 删掉客户B，再同步给 Windows
active = devices.a;
await sleep(5);
const doomed = (await A.listForHost("mp.weixin.qq.com")).find(
  (item) => item.username === "client_b@brand.com",
);
await A.deleteEntry(doomed.id);
const recA2 = await A.exportRecord();

active = devices.b;
const removed = await B.importRecord(recA2, PWD);
assert.equal(removed.deleted, 1, "删除要能同步出去");
assert.equal(removed.total, 2);
const afterDelete = await B.listForHost("mp.weixin.qq.com");
assert.equal(afterDelete.length, 2);
assert.ok(!afterDelete.some((item) => item.username === "client_b@brand.com"));

// Windows 改密码，同步回 Mac
await sleep(5);
const living = afterDelete.find((item) => item.username === "client_a@brand.com");
await B.updateEntry({ ...living, password: "passA-new" });
const recB = await B.exportRecord();

active = devices.a;
const back = await A.importRecord(recB, PWD);
assert.equal(back.updated, 1, "改密码要能同步回来");
const aFinal = await A.listForHost("mp.weixin.qq.com");
assert.equal(aFinal.find((item) => item.username === "client_a@brand.com").password, "passA-new");
assert.equal(aFinal.length, 2, "被删的那条不能在 Mac 上复活");

// 第三台空库直接接管
active = devices.c;
await C.setup(PWD);
const takeover = await C.importRecord(recB);
assert.equal(takeover.mode, "replaced", "空库直接接管备份");

console.log("sync: 三台设备端到端 12 组断言全部通过");
