import type { Entry } from "./types";

export interface MergeResult {
  entries: Entry[];
  /** 备份里有、本地没有 */
  added: number;
  /** 两边都有，备份那条更新 */
  updated: number;
  /** 备份里是墓碑，本地还活着 */
  deleted: number;
}

/** 旧数据没有 updatedAt，用创建时间和最后使用时间兜底 */
function stampOf(entry: Entry): number {
  if (typeof entry.updatedAt === "number") return entry.updatedAt;
  return Math.max(entry.createdAt || 0, entry.lastUsedAt || 0);
}

/**
 * 「同一个账号」的判定。两台机器各自新建同一条记录时 id 不同，
 * 只按 id 合并会留下两条重复，所以还要按「域 + 范围 + 登录名」认一次。
 */
function semanticKey(entry: Entry): string {
  const scopePart = entry.scope === "host" ? entry.host : entry.domain;
  return `${entry.domain}\u0000${scopePart}\u0000${entry.username.trim().toLowerCase()}`;
}

/**
 * 合并两份记录：
 * 1. 先按 id 比时间戳，新的胜出
 * 2. 再按语义键去重，同一个账号只留最新那条
 * 3. 墓碑参与比较，所以「在 A 机删掉」能同步到 B 机，而不是被 B 机复活
 */
export function mergeEntries(local: Entry[], incoming: Entry[]): MergeResult {
  const byId = new Map<string, Entry>();
  for (const entry of local) {
    if (entry?.id) byId.set(entry.id, entry);
  }
  for (const entry of incoming) {
    if (!entry?.id) continue;
    const current = byId.get(entry.id);
    if (!current || stampOf(entry) > stampOf(current)) byId.set(entry.id, entry);
  }

  const alive = new Map<string, Entry>();
  const tombstones: Entry[] = [];
  for (const entry of byId.values()) {
    if (entry.deletedAt) {
      tombstones.push(entry);
      continue;
    }
    const key = semanticKey(entry);
    const current = alive.get(key);
    if (!current || stampOf(entry) > stampOf(current)) alive.set(key, entry);
  }

  const final = new Map<string, Entry>();
  for (const entry of alive.values()) final.set(entry.id, entry);

  for (const tombstone of tombstones) {
    const key = semanticKey(tombstone);
    const living = alive.get(key);
    if (!living) {
      // 本地从来没有过这条，墓碑也要留着，否则下次合并又会被对方复活
      final.set(tombstone.id, tombstone);
      continue;
    }
    if (stampOf(tombstone) > stampOf(living)) {
      final.delete(living.id);
      final.set(tombstone.id, tombstone);
    }
  }

  const localAlive = local.filter((entry) => !entry.deletedAt);
  const finalAlive = [...final.values()].filter((entry) => !entry.deletedAt);
  const finalKeys = new Set(finalAlive.map(semanticKey));

  let added = 0;
  let updated = 0;
  for (const entry of finalAlive) {
    const old = localAlive.find((item) => semanticKey(item) === semanticKey(entry));
    if (!old) added += 1;
    else if (
      old.id !== entry.id ||
      old.password !== entry.password ||
      old.label !== entry.label ||
      old.note !== entry.note
    ) {
      updated += 1;
    }
  }

  const deleted = localAlive.filter((entry) => !finalKeys.has(semanticKey(entry))).length;

  return { entries: [...final.values()], added, updated, deleted };
}

/** 展示层过滤掉墓碑 */
export function visibleEntries(entries: Entry[]): Entry[] {
  return entries.filter((entry) => !entry.deletedAt);
}
