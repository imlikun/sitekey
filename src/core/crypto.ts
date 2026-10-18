const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const PBKDF2_ITERATIONS = 310_000;
const VERIFIER = "sitekey:verifier:v1";

export function toBase64(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function asBufferSource(value: Uint8Array): BufferSource {
  return value as unknown as BufferSource;
}

export async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations = PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: asBufferSource(salt), iterations, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

export async function encryptText(key: CryptoKey, text: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(text));
  return toBase64(concat(iv, new Uint8Array(ciphertext)));
}

export async function decryptText(key: CryptoKey, payload: string): Promise<string> {
  const raw = fromBase64(payload);
  const iv = asBufferSource(raw.slice(0, 12));
  const ciphertext = asBufferSource(raw.slice(12));
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return decoder.decode(plaintext);
}

export async function exportKey(key: CryptoKey): Promise<string> {
  return toBase64(await crypto.subtle.exportKey("raw", key));
}

export async function importKey(raw: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    asBufferSource(fromBase64(raw)),
    "AES-GCM",
    true,
    ["encrypt", "decrypt"],
  );
}

export async function createVerifier(key: CryptoKey): Promise<string> {
  return encryptText(key, VERIFIER);
}

export async function checkVerifier(key: CryptoKey, verifier: string): Promise<boolean> {
  try {
    return (await decryptText(key, verifier)) === VERIFIER;
  } catch {
    return false;
  }
}

export function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
