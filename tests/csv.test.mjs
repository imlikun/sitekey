import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import esbuild from "esbuild";

// 把 TS 解析器打成临时 ESM，再直接 import 进来跑断言
const dir = await mkdtemp(join(tmpdir(), "sitekey-csv-"));
const outfile = join(dir, "csv.mjs");
await esbuild.build({
  entryPoints: ["src/core/csv.ts"],
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  outfile,
  logLevel: "silent",
});
const { parseChromeCsv, classifyUrl } = await import(outfile);

const CSV = `name,url,username,password,note
微信公众平台,https://mp.weixin.qq.com/,client_a@brand.com,passA1,"客户A · 公众号，备注里带,逗号
和第二行"
mp.weixin.qq.com,https://mp.weixin.qq.com/,client_b@brand.com,passB1,
mp.weixin.qq.com,https://mp.weixin.qq.com/,client_a@brand.com,passA1,
GitHub,https://github.com/login,me@brand.com,"pa""ss",注释
GitHub,https://gist.github.com/,me@brand.com,gistpass,
com.example.app,android://abc@com.example.app/,me@brand.com,apppass,
Chrome,chrome://settings/passwords,,,
,https://nouser.example.com/,,"x",
,https://nopass.example.com/,someone@x.com,,
,example.com/login,bare@x.com,barepass,
`;

const report = parseChromeCsv(CSV);

// 逐行分类：10 行数据 → 5 条可导，5 条跳过/合并
assert.equal(report.total, 10, "total 应该是 10 行");
assert.equal(report.imported, 5, "可导入 5 条");
assert.equal(report.duplicates, 1, "client_a 重复一次");
assert.equal(report.conflicts, 0, "本例没有密码冲突");
assert.equal(report.hostScoped, 2, "github.com / gist.github.com 两个子域按 host 导入");

const reasons = Object.fromEntries(report.skipped.map((item) => [item.reason, item.count]));
assert.equal(reasons["app-only"], 1, "android:// 归到 App 内密码");
assert.equal(reasons.internal, 1, "chrome:// 归到浏览器内部页面");
assert.equal(reasons["no-username"], 1, "缺登录名");
assert.equal(reasons["no-password"], 1, "缺密码");

// 标签：微信三条 name 不一致（站点名 / 域名的混合）→ 退回登录名派生，不能用站点名
const weixin = report.drafts.filter((draft) => draft.host === "mp.weixin.qq.com");
assert.equal(weixin.length, 2);
assert.deepEqual(weixin.map((draft) => draft.label).sort(), ["client_a", "client_b"]);
assert.equal(weixin[0].scope, "smart", "站点只有一个子域时用智能匹配");
assert.equal(weixin[0].domain, "qq.com", "注册域归一：qq.com 这类共享平台靠 SHARED_DOMAINS 退回精确 host");
assert.equal(weixin[0].note?.startsWith("客户A · 公众号，备注里带,逗号"), true, "引号内的逗号与换行要保留");

// 同一账号不同子域：两条都保留，且退化为仅此域名
const github = report.drafts.filter((draft) => draft.domain === "github.com");
assert.equal(github.length, 2);
assert.ok(
  github.every((draft) => draft.scope === "host"),
  "多子域站点要退化成 host，否则会互相覆盖",
);
assert.deepEqual(github.map((draft) => draft.host).sort(), ["gist.github.com", "github.com"]);

// 引号里的双引号转义
const quoted = report.drafts.find((draft) => draft.host === "github.com");
assert.equal(quoted?.password, 'pa"ss');

// 没写协议头的裸域名也要能认
const bare = report.drafts.find((draft) => draft.domain === "example.com");
assert.equal(bare?.host, "example.com");
assert.equal(bare?.password, "barepass");

// host 汇总按条数倒序，且显示具体 host 而不是注册域
assert.equal(report.hosts[0].host, "mp.weixin.qq.com");
assert.equal(report.hosts[0].count, 2);

// 单条分类
assert.equal(classifyUrl("https://a.example.com/x").kind, "web");
assert.equal(classifyUrl("android://hash@com.tencent.mm/").kind, "app");
assert.equal(classifyUrl("ios://abc@com.app/").kind, "app");
assert.equal(classifyUrl("chrome-extension://abc/popup.html").kind, "internal");
assert.equal(classifyUrl("").kind, "invalid");
assert.equal(classifyUrl("随便写的东西").kind, "invalid");

// 有 BOM 的导出文件：表头不能被 BOM 污染
const bomReport = parseChromeCsv(`\uFEFF${CSV}`);
assert.equal(bomReport.imported, report.imported, "带 BOM 的结果应与不带一致");

// 只有一条账号时，可信的 name 可以直接当标签
const single = parseChromeCsv(`name,url,username,password,note
公司后台,https://admin.brand.com/,ops@brand.com,pw,`);
assert.equal(single.drafts[0].label, "公司后台");

// name 就是站点名时不能当标签
const siteNamed = parseChromeCsv(`name,url,username,password,note
admin.brand.com,https://admin.brand.com/,ops@brand.com,pw,`);
assert.equal(siteNamed.drafts[0].label, "ops");

// 表头缺失要报错
assert.throws(
  () => parseChromeCsv("foo,bar\n1,2\n"),
  /CSV_MISSING_COLUMNS/,
  "缺少列时应抛出 CSV_MISSING_COLUMNS",
);

// 空文件
const empty = parseChromeCsv("");
assert.equal(empty.total, 0);
assert.equal(empty.imported, 0);

await writeFile(join(dir, ".keep"), "");
console.log("csv: 12 组断言全部通过");
