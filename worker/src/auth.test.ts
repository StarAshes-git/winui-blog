import { describe, it, expect, beforeEach } from "vitest";
import {
  hashPassword,
  verifyPassword,
  generateToken,
  createSession,
  getSessionToken,
  deleteSession,
  getToken,
} from "./auth";
import type { Env } from "./index";

function makeKv(): KVNamespace {
  const map = new Map<string, string>();
  return {
    get: async (key: string) => map.get(key) ?? null,
    put: async (key: string, value: string, opts?: { expirationTtl?: number }) => {
      map.set(key, value);
    },
    delete: async (key: string) => {
      map.delete(key);
    },
  } as unknown as KVNamespace;
}

let env: Env;
beforeEach(() => {
  env = {
    DB: {} as D1Database,
    SESSIONS: makeKv(),
    ASSETS: {} as Fetcher,
  };
});

describe("auth", () => {
  it("hashPassword 产生 salt:hash 格式，verifyPassword 校验通过", async () => {
    const stored = await hashPassword("admin");
    expect(stored).toMatch(/^[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
    expect(await verifyPassword("admin", stored)).toBe(true);
    expect(await verifyPassword("wrong", stored)).toBe(false);
  });

  it("相同密码不同 salt 产生不同哈希", async () => {
    const a = await hashPassword("admin");
    const b = await hashPassword("admin");
    expect(a).not.toBe(b);
    expect(await verifyPassword("admin", b)).toBe(true);
  });

  it("generateToken 返回 64 位 hex", () => {
    expect(generateToken()).toMatch(/^[0-9a-f]{64}$/);
    expect(generateToken()).not.toBe(generateToken());
  });

  it("会话创建/查询/删除", async () => {
    const token = generateToken();
    await createSession(env, token);
    expect(await getSessionToken(env, token)).toBeTruthy();
    await deleteSession(env, token);
    expect(await getSessionToken(env, token)).toBeNull();
  });

  it("getToken 解析 Bearer 头", () => {
    const token = generateToken();
    const req = new Request("https://x.test/", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(getToken(req)).toBe(token);
    expect(getToken(new Request("https://x.test/"))).toBeNull();
  });
});
