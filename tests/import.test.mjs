import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import esbuild from "esbuild";

/**
 * Chrome CSV 导入 × 多机同步的交叉验证。
 * 这两条路径单独看都没问题，撞在一起才会出事，所以单独测一组：
 * 1) 导入覆盖密码后，合并到另一台机器不能被旧密码顶回去
 * 2) 删除过的账号再从 CSV 导入，要能重新出现，而不是悄悄钻进墓碑
 */

const dir = await mkdtemp(join(tmpdir(), "sitekey-import-"));
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

const PWD = "import-test-2026";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const csvRow = (password) => ({
  domain: "qq.com",
  host: "mp.weixin.qq.com",
  scope: "smart",
  username: "ops@brand.com",
  password,
  label: "运营号",
});

// Mac 建库，存一条
active = devices.a;
await A.setup(PWD);
await A.saveDraft(csvRow("pass-v1"));
const recA = await A.exportRecord();

// Windows 空库接管
active = devices.b;
await B.setup(PWD);
const takeover = await B.importRecord(recA);
assert.equal(takeover.mode, "replaced");
await B.unlock(PWD);

// Windows 上从 Chrome CSV 导入，把密码换成 v2
await sleep(8);
const counts = await B.importDrafts([csvRow("pass-v2")]);
assert.deepEqual(counts, { added: 0, updated: 1 }, "同一条账号应该算更新，不是新增");

const bList = await B.listForHost("mp.weixin.qq.com");
assert.equal(bList.length, 1);
assert.equal(bList[0].password, "pass-v2", "导入应该立刻在 B 上生效");

// 带回 Mac：不能被 v1 顶回去
const recB = await B.exportRecord();
active = devices.a;
await A.importRecord(recB, PWD);
const aList = await A.listForHost("mp.weixin.qq.com");
assert.equal(aList[0].password, "pass-v2", "导入改的密码要能同步回另一台机器");

// 删除后再导入：要复活，不能进墓碑
active = devices.b;
await B.deleteEntry(bList[0].id);
assert.equal((await B.listForHost("mp.weixin.qq.com")).length, 0, "删除后列表应为空");

await B.importDrafts([csvRow("pass-v3")]);
const revived = await B.listForHost("mp.weixin.qq.com");
assert.equal(revived.length, 1, "删过的账号再导入，必须重新出现在列表里");
assert.equal(revived[0].password, "pass-v3");

// 复活的条目要赢过墓碑，否则同步一圈又被删掉
const recRevived = await B.exportRecord();
active = devices.a;
const back = await A.importRecord(recRevived, PWD);
assert.equal(back.deleted, 0, "重新导入的账号不该在合并时被墓碑删掉");
assert.equal((await A.listForHost("mp.weixin.qq.com"))[0].password, "pass-v3");

console.log("import: CSV 导入 × 多机同步 9 组断言全部通过");
