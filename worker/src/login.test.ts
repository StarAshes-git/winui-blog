import { describe, it, expect } from "vitest";
import worker from "./index";

function makeD1(settings: Map<string, string>): D1Database {
  return {
    prepare: (sql: string) => {
      const stmt = {
        async first<T>(col?: string): Promise<T | null> {
          const m = /key = '?(\w+)'?/.exec(sql);
          if (!m) return null;
          const val = settings.get(m[1]);
          if (!val) return null;
          if (col) return (val as unknown) as T;
          return { value: val } as unknown as T;
        },
        async run() {
          return { meta: { changes: 0, last_row_id: 1 } };
        },
        async all() {
          return { results: [] };
        },
        bind() {
          return this;
        },
      };
      return stmt as unknown as D1PreparedStatement;
    },
  } as unknown as D1Database;
}

function makeEnv(settings: Map<string, string>) {
  return {
    DB: makeD1(settings),
    SESSIONS: {
      put: async () => undefined,
    } as unknown as KVNamespace,
    ASSETS: {
      fetch: (request: Request) => new Response("asset-mock", { status: 200 }),
    } as unknown as Fetcher,
  };
}

describe("login 首次认证", () => {
  it("settings 无 password_hash 时默认密码 admin 可登录", async () => {
    const env = makeEnv(new Map());
    const res = await worker.fetch(
      new Request("https://example.com/api/login", {
        method: "POST",
        body: JSON.stringify({ password: "admin" }),
        headers: { "Content-Type": "application/json" },
      }),
      env,
      {} as ExecutionContext
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect((data as { token: string }).token).toBeTruthy();
  });

  it("settings 无 password_hash 时错误密码返回 401", async () => {
    const env = makeEnv(new Map());
    const res = await worker.fetch(
      new Request("https://example.com/api/login", {
        method: "POST",
        body: JSON.stringify({ password: "wrong" }),
        headers: { "Content-Type": "application/json" },
      }),
      env,
      {} as ExecutionContext
    );
    expect(res.status).toBe(401);
  });
});
