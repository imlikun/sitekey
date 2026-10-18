export function suggestLabel(username: string, fallback = ""): string {
  const value = username.trim();
  if (!value) return fallback;
  if (value.includes("@")) {
    const local = value.split("@")[0]?.trim();
    if (local) return local;
  }
  if (/^\+?\d[\d\s-]{5,}$/.test(value)) {
    const digits = value.replace(/\D/g, "");
    if (digits.length >= 4) return `尾号${digits.slice(-4)}`;
  }
  return value.length > 24 ? `${value.slice(0, 24)}…` : value;
}

export function relativeTime(timestamp: number): string {
  if (!timestamp) return "从未使用";
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return "刚刚";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} 个月前`;
  return `${Math.floor(months / 12)} 年前`;
}

export function initialOf(label: string, username: string, domain: string): string {
  const source = (label || username || domain).trim();
  const first = Array.from(source)[0] ?? "?";
  return first.toUpperCase();
}

// 收在青—蓝—靛—紫的冷色带里，与品牌色 #6d6af0 同族，避开黄、品红等跳脱色相。
// 相邻色相间隔 30°，保证并排时肉眼能分清，不会糊成一片同色。
const PALETTE = [190, 220, 250, 280];

export function hueOf(text: string, offset = 0): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return PALETTE[(hash + offset) % PALETTE.length];
}
