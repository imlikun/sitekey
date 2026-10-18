const SETS = {
  upper: "ABCDEFGHJKLMNPQRSTUVWXYZ",
  lower: "abcdefghijkmnopqrstuvwxyz",
  digits: "23456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.?",
};

export interface GenOptions {
  upper: boolean;
  lower: boolean;
  digits: boolean;
  symbols: boolean;
}

export const DEFAULT_GEN_OPTIONS: GenOptions = {
  upper: true,
  lower: true,
  digits: true,
  symbols: true,
};

function pick(chars: string): string {
  const bytes = crypto.getRandomValues(new Uint32Array(1));
  return chars[bytes[0]! % chars.length]!;
}

export function generatePassword(length = 20, options: GenOptions = DEFAULT_GEN_OPTIONS): string {
  const selected = (Object.keys(SETS) as (keyof GenOptions)[])
    .filter((key) => options[key])
    .map((key) => SETS[key]);

  const pool = selected.join("");
  if (!pool) return pick(SETS.lower).repeat(length);

  const result: string[] = [];
  for (const set of selected) result.push(pick(set));
  while (result.length < length) result.push(pick(pool));

  for (let i = result.length - 1; i > 0; i -= 1) {
    const bytes = crypto.getRandomValues(new Uint32Array(1));
    const j = bytes[0]! % (i + 1);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result.slice(0, length).join("");
}

export function passwordScore(password: string): number {
  let score = 0;
  if (password.length >= 12) score += 1;
  if (password.length >= 18) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.min(score, 4);
}
