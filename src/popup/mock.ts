import { registrableDomain } from "../core/domain";
import type { Entry, Settings, VaultStatus } from "../core/types";

function seedEntries(): Entry[] {
  const now = Date.now();
  const day = 86_400_000;
  return [
    {
      id: "demo-1",
      domain: "qq.com",
      host: "mp.weixin.qq.com",
      scope: "smart",
      username: "kun_work@163.com",
      password: "Sk-demo-9f2K!mQ7",
      label: "客户A · 公众号",
      note: "品牌代运营",
      createdAt: now - day * 46,
      lastUsedAt: now - 3_600_000,
      useCount: 28,
    },
    {
      id: "demo-2",
      domain: "qq.com",
      host: "mp.weixin.qq.com",
      scope: "smart",
      username: "likun@appin.site",
      password: "Sk-demo-4hT8#wL2",
      label: "自己号 · 主号",
      note: "个人订阅号",
      createdAt: now - day * 210,
      lastUsedAt: now - day * 3,
      useCount: 9,
    },
    {
      id: "demo-3",
      domain: "qq.com",
      host: "mp.weixin.qq.com",
      scope: "smart",
      username: "wx_abc@qq.com",
      password: "Sk-demo-7pR3@nV5",
      label: "客户B · 服务号",
      note: "活动运营",
      createdAt: now - day * 120,
      lastUsedAt: now - day * 21,
      useCount: 4,
    },
    {
      id: "demo-4",
      domain: "qq.com",
      host: "mp.weixin.qq.com",
      scope: "smart",
      username: "test_01@163.com",
      password: "Sk-demo-2mX6$kD9",
      label: "品牌代运营 · 测试号",
      createdAt: now - day * 60,
      lastUsedAt: now - day * 48,
      useCount: 2,
    },
    {
      id: "demo-5",
      domain: "qq.com",
      host: "mp.weixin.qq.com",
      scope: "smart",
      username: "old_2019@163.com",
      password: "Sk-demo-8qW1!cF4",
      label: "旧号 · 已停用",
      createdAt: now - day * 800,
      lastUsedAt: now - day * 220,
      useCount: 0,
    },
  ];
}

export function installMock(): void {
  const globalObject = globalThis as unknown as { chrome?: Record<string, any> };
  if (globalObject.chrome?.runtime?.id) return;

  const params = new URLSearchParams(location.search);
  const mode = params.get("state");
  let status: VaultStatus = mode === "locked" ? "locked" : mode === "setup" ? "uninitialized" : "unlocked";
  let entries = mode === "setup" || mode === "locked" ? seedEntries() : seedEntries();
  let settings: Settings = { autoLockMinutes: 5, autoCapture: true, showSavePrompt: true };

  const host = "mp.weixin.qq.com";
  const ok = (data: Record<string, unknown> = {}) => ({ ok: true, ...data });

  globalObject.chrome = {
    runtime: {
      id: "mock",
      async sendMessage(request: Record<string, any>) {
        switch (request.type) {
          case "STATUS":
            return ok({ status });
          case "LIST":
            return ok({
              host,
              domain: registrableDomain(host),
              entries: status === "unlocked" ? [...entries] : [],
            });
          case "FILL":
            return ok();
          case "SAVE":
            entries = [
              {
                id: `mock-${Date.now()}`,
                ...request.draft,
                createdAt: Date.now(),
                lastUsedAt: Date.now(),
                useCount: 1,
              },
              ...entries,
            ];
            return ok({ created: true });
          case "UPDATE":
            entries = entries.map((entry) =>
              entry.id === request.entry.id ? { ...entry, ...request.entry } : entry,
            );
            return ok();
          case "DELETE":
            entries = entries.filter((entry) => entry.id !== request.id);
            return ok();
          case "LOCK":
            status = "locked";
            return ok();
          case "UNLOCK":
            status = "unlocked";
            return ok();
          case "SETUP":
            status = "unlocked";
            return ok();
          case "GET_SETTINGS":
            return ok({ settings });
          case "SET_SETTINGS":
            settings = { ...settings, ...request.settings };
            return ok({ settings });
          default:
            return ok();
        }
      },
      openOptionsPage() {
        window.open("options.html", "_blank", "noopener");
      },
      getURL(path: string) {
        return path;
      },
    },
    tabs: {
      async query() {
        return [{ id: 1, url: `https://${host}/cgi-bin/loginpage` }];
      },
    },
  };
}
