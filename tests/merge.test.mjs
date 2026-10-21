import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import esbuild from "esbuild";

const dir = await mkdtemp(join(tmpdir(), "sitekey-merge-"));
const outfile = join(dir, "merge.mjs");
await esbuild.build({
  entryPoints: ["src/core/merge.ts"],
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  outfile,
  logLevel: "silent",
});
const { mergeEntries, visibleEntries } = await import(outfile);

const base = {
  domain: "example.com",
  host: "login.example.com",
  scope: "smart",
  username: "a@brand.com",
  password: "pw",
  label: "A",
  createdAt: 1000,
  lastUsedAt: 1000,
  useCount: 1,
};

function entry(id, patch = {}) {
  return { ...base, id, ...patch };
}

// 1. 备份里有本地没有的 → 新增
{
  const result = mergeEntries(
    [entry("a", { username: "a@x.com" })],
    [entry("a", { username: "a@x.com" }), entry("b", { username: "b@x.com" })],
  );
  assert.equal(result.added, 1);
  assert.equal(result.updated, 0);
  assert.equal(result.deleted, 0);
  assert.equal(result.entries.length, 2);
}

// 2. 同一条两边都有，备份更新时间更晚 → 更新
{
  const local = [entry("a", { password: "old", updatedAt: 2000 })];
  const incoming = [entry("a", { password: "new", updatedAt: 3000 })];
  const result = mergeEntries(local, incoming);
  assert.equal(result.updated, 1);
  assert.equal(result.added, 0);
  assert.equal(result.entries[0].password, "new");
}

// 3. 本地更新 → 备份不覆盖本地
{
  const local = [entry("a", { password: "local-new", updatedAt: 5000 })];
  const incoming = [entry("a", { password: "remote-old", updatedAt: 3000 })];
  const result = mergeEntries(local, incoming);
  assert.equal(result.updated, 0);
  assert.equal(result.entries[0].password, "local-new");
}

// 4. 备份里是墓碑，本地还活着 → 删除
{
  const local = [entry("a", { updatedAt: 1000 })];
  const incoming = [entry("a", { updatedAt: 4000, deletedAt: 4000 })];
  const result = mergeEntries(local, incoming);
  assert.equal(result.deleted, 1);
  assert.equal(visibleEntries(result.entries).length, 0);
}

// 5. 本地已是墓碑，备份是更旧的活记录 → 不能复活
{
  const local = [entry("a", { updatedAt: 5000, deletedAt: 5000 })];
  const incoming = [entry("a", { updatedAt: 2000 })];
  const result = mergeEntries(local, incoming);
  assert.equal(result.updated, 0);
  assert.equal(result.added, 0);
  assert.equal(visibleEntries(result.entries).length, 0);
}

// 6. 旧数据没有 updatedAt → 用 createdAt / lastUsedAt 兜底
{
  const local = [entry("a", { password: "old", createdAt: 1000, lastUsedAt: 1000 })];
  const incoming = [entry("a", { password: "new", createdAt: 2000, lastUsedAt: 2000 })];
  const result = mergeEntries(local, incoming);
  assert.equal(result.updated, 1);
  assert.equal(result.entries[0].password, "new");
}

// 7. 两边新增了不同账号 → 都保留（合集，不互相覆盖）
{
  const local = [entry("mac-1", { username: "mac1@x.com" }), entry("mac-2", { username: "mac2@x.com" })];
  const incoming = [entry("win-1", { username: "win1@x.com" }), entry("win-2", { username: "win2@x.com" })];
  const result = mergeEntries(local, incoming);
  assert.equal(result.added, 2);
  assert.equal(result.entries.length, 4);
}

// 8. 无 id 的脏数据跳过，不炸
{
  const result = mergeEntries([entry("a")], [{ ...base }, null, undefined]);
  assert.equal(result.entries.length, 1);
  assert.equal(result.added, 0);
}

// 9. 合并两次是幂等的：同一份备份连导两遍，第二次没有任何变化
{
  const local = [entry("a", { username: "a@x.com", updatedAt: 1000 })];
  const incoming = [entry("b", { username: "b@x.com", updatedAt: 2000 })];
  const first = mergeEntries(local, incoming);
  const second = mergeEntries(first.entries, incoming);
  assert.equal(second.added, 0);
  assert.equal(second.updated, 0);
  assert.equal(second.deleted, 0);
  assert.equal(second.entries.length, first.entries.length);
}

// 10. 两台机器各自新建了同一个账号（id 不同）→ 合并成一条，留新的
{
  const local = [entry("mac-id", { username: "same@x.com", password: "mac-pw", updatedAt: 3000 })];
  const incoming = [entry("win-id", { username: "same@x.com", password: "win-pw", updatedAt: 4000 })];
  const result = mergeEntries(local, incoming);
  assert.equal(visibleEntries(result.entries).length, 1);
  assert.equal(visibleEntries(result.entries)[0].password, "win-pw");
}

// 11. 两边各删了一条不同记录 → 两条都删掉，不互相复活
{
  const local = [
    entry("a", { username: "a@x.com", updatedAt: 5000, deletedAt: 5000 }),
    entry("b", { username: "b@x.com", updatedAt: 1000 }),
  ];
  const incoming = [
    entry("a", { username: "a@x.com", updatedAt: 1000 }),
    entry("b", { username: "b@x.com", updatedAt: 5000, deletedAt: 5000 }),
  ];
  const result = mergeEntries(local, incoming);
  assert.equal(visibleEntries(result.entries).length, 0);
  assert.equal(result.deleted, 1);
}

console.log("merge: 11 组断言全部通过");
