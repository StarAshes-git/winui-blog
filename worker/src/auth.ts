import type { Env } from "./index";

const PBKDF2_ITERATIONS = 100_000;

export const DEFAULT_PASSWORD = "admin";

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: new Uint8Array(salt).buffer, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(password, salt);
  return `${toBase64(salt)}:${toBase64(key)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltBase64, hashBase64] = stored.split(":");
  if (!saltBase64 || !hashBase64) return false;
  const salt = fromBase64(saltBase64);
  const storedKey = fromBase64(hashBase64);
  const derivedKey = await deriveKey(password, salt);
  if (derivedKey.length !== storedKey.length) return false;
  let diff = 0;
  for (let i = 0; i < derivedKey.length; i++) diff |= derivedKey[i] ^ storedKey[i];
  return diff === 0;
}

export function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createSession(env: Env, token: string): Promise<void> {
  await env.SESSIONS.put(
    `session:${token}`,
    JSON.stringify({ createdAt: Date.now() }),
    { expirationTtl: 604800 }
  );
}

export async function deleteSession(env: Env, token: string): Promise<void> {
  await env.SESSIONS.delete(`session:${token}`);
}

export async function getSessionToken(env: Env, token: string): Promise<string | null> {
  return env.SESSIONS.get(`session:${token}`);
}

export function getToken(request: Request): string | null {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}
