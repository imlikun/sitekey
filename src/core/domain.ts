import type { Entry } from "./types";

/**
 * A compact public-suffix subset. It covers the suffixes that matter for a
 * personal vault (China, HK/MO/TW, UK, JP, KR, AU/NZ, EU, LATAM, hosting
 * platforms). It is intentionally not the full PSL: the extension must work
 * offline and stay tiny. Unknown multi-label suffixes fall back to eTLD+1,
 * which is documented as a known limitation.
 */
const MULTI_SUFFIXES = new Set([
  "com.cn",
  "net.cn",
  "org.cn",
  "gov.cn",
  "edu.cn",
  "ac.cn",
  "com.hk",
  "org.hk",
  "net.hk",
  "edu.hk",
  "gov.hk",
  "com.mo",
  "org.mo",
  "net.mo",
  "edu.mo",
  "gov.mo",
  "com.tw",
  "org.tw",
  "net.tw",
  "edu.tw",
  "gov.tw",
  "com.sg",
  "org.sg",
  "net.sg",
  "edu.sg",
  "gov.sg",
  "com.my",
  "org.my",
  "net.my",
  "edu.my",
  "gov.my",
  "co.uk",
  "org.uk",
  "me.uk",
  "ac.uk",
  "gov.uk",
  "ltd.uk",
  "plc.uk",
  "co.jp",
  "or.jp",
  "ne.jp",
  "ac.jp",
  "go.jp",
  "co.kr",
  "or.kr",
  "ne.kr",
  "ac.kr",
  "go.kr",
  "com.au",
  "net.au",
  "org.au",
  "edu.au",
  "gov.au",
  "id.au",
  "co.nz",
  "net.nz",
  "org.nz",
  "govt.nz",
  "ac.nz",
  "com.br",
  "net.br",
  "org.br",
  "gov.br",
  "edu.br",
  "co.in",
  "net.in",
  "org.in",
  "gov.in",
  "ac.in",
  "co.za",
  "org.za",
  "net.za",
  "gov.za",
  "com.mx",
  "com.ar",
  "com.tr",
  "com.ru",
  "com.ua",
  "com.pl",
  "com.es",
  "com.it",
  "co.il",
  "co.id",
  "co.th",
  "co.ve",
  "com.co",
  "com.pe",
  "com.cl",
  "co.at",
  "or.at",
  "gv.at",
  "co.hu",
  "com.pt",
  "com.gr",
  "com.ro",
  "com.vn",
  "com.ph",
  "com.pk",
  "com.bd",
  "com.eg",
  "com.sa",
  "com.ae",
  "github.io",
  "gitlab.io",
  "vercel.app",
  "netlify.app",
  "pages.dev",
  "workers.dev",
  "web.app",
  "firebaseapp.com",
  "appspot.com",
  "blogspot.com",
  "herokuapp.com",
  "azurewebsites.net",
  "cloudfront.net",
  "notion.site",
  "readthedocs.io",
]);

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * Large consumer platforms share one registrable domain across unrelated
 * services (mp.weixin.qq.com vs mail.qq.com, mail.google.com vs drive.google.com).
 * For these, "smart" matching falls back to exact-host so a 公众号 credential
 * never shows up on QQ Mail.
 */
const SHARED_DOMAINS = new Set([
  "qq.com",
  "tencent.com",
  "weixin.qq.com",
  "wechat.com",
  "google.com",
  "googleusercontent.com",
  "microsoft.com",
  "live.com",
  "office.com",
  "apple.com",
  "icloud.com",
  "amazon.com",
  "alibaba.com",
  "aliyun.com",
  "taobao.com",
  "tmall.com",
  "alipay.com",
  "jd.com",
  "163.com",
  "126.com",
  "sina.com.cn",
  "weibo.com",
  "sohu.com",
  "baidu.com",
  "bilibili.com",
  "zhihu.com",
  "douban.com",
  "github.com",
  "gitlab.com",
  "atlassian.net",
  "salesforce.com",
  "feishu.cn",
  "larksuite.com",
  "dingtalk.com",
  "x.com",
  "twitter.com",
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "slack.com",
  "notion.so",
  "dropbox.com",
  "box.com",
  "zoom.us",
  "cloudflare.com",
  "vercel.com",
  "netlify.com",
]);

export function hostFromUrl(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function isIpHost(host: string): boolean {
  return IPV4.test(host) || host.includes(":");
}

export function registrableDomain(host: string): string {
  if (!host) return "";
  const normalized = host.toLowerCase().replace(/\.$/, "");
  if (isIpHost(normalized) || normalized === "localhost") return normalized;
  const parts = normalized.split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");

  for (let i = 0; i < parts.length - 1; i += 1) {
    const suffix = parts.slice(i).join(".");
    if (MULTI_SUFFIXES.has(suffix)) {
      const start = Math.max(0, i - 1);
      return parts.slice(start).join(".");
    }
  }
  return parts.slice(-2).join(".");
}

export function wildcardMatch(pattern: string, host: string): boolean {
  const value = pattern.trim().toLowerCase();
  if (!value || !host) return false;
  if (value === host) return true;
  if (value.startsWith("*.")) {
    const suffix = value.slice(2);
    return host === suffix || host.endsWith(`.${suffix}`);
  }
  if (value.startsWith(".")) {
    const suffix = value.slice(1);
    return host === suffix || host.endsWith(`.${suffix}`);
  }
  return false;
}

export function entryMatchesHost(entry: Entry, host: string): boolean {
  if (!host) return false;
  switch (entry.scope) {
    case "host":
      return entry.host === host;
    case "domain":
      return registrableDomain(host) === entry.domain;
    case "custom":
      return wildcardMatch(entry.pattern || entry.domain, host);
    case "smart":
    default:
      if (entry.host === host) return true;
      if (registrableDomain(host) !== entry.domain) return false;
      if (SHARED_DOMAINS.has(entry.domain)) return false;
      return true;
  }
}

export function sortEntries<T extends Entry>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    if (b.lastUsedAt !== a.lastUsedAt) return b.lastUsedAt - a.lastUsedAt;
    if (b.useCount !== a.useCount) return b.useCount - a.useCount;
    return a.label.localeCompare(b.label, "zh-Hans-CN");
  });
}
