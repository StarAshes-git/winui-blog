import { describe, it, expect } from "vitest";
import worker from "./index";

function makeD1(settings: Map<string, string>): D1Database {
  return {
    prepare: (sql: string) => {
      let params: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) {
          params = args;
          return this;
        },
        async first<T>(col?: string): Promise<T | null> {
          const key = params[0] as string;
          if (!key) return null;
          const val = settings.get(key);
          if (val === undefined) return null;
          if (col) return (val as unknown) as T;
          return { value: val } as unknown as T;
        },
        async run(): Promise<{ meta: { changes: number; last_row_id: number } }> {
          const m = /VALUES \('(\w+)'/.exec(sql);
          if (m) settings.set(m[1], params[0] as string);
          return { meta: { changes: 1, last_row_id: 1 } };
        },
        async all() {
          return { results: [] };
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
      get: async () => JSON.stringify({ createdAt: Date.now() }),
      delete: async () => undefined,
    } as unknown as KVNamespace,
    ASSETS: {
      fetch: (request: Request) => new Response("asset-mock", { status: 200 }),
    } as unknown as Fetcher,
  };
}

describe("site 接口", () => {
  it("GET /api/site 返回 intro、site_name、avatar_url", async () => {
    const settings = new Map([
      ["intro", "你好"],
      ["site_name", "小明博客"],
      ["avatar_url", "https://example.com/a.png"],
    ]);
    const env = makeEnv(settings);
    const res = await worker.fetch(new Request("https://example.com/api/site"), env, {} as ExecutionContext);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      intro: "你好",
      site_name: "小明博客",
      avatar_url: "https://example.com/a.png",
    });
  });

  it("GET /api/site 未设置字段返回空串", async () => {
    const env = makeEnv(new Map());
    const res = await worker.fetch(new Request("https://example.com/api/site"), env, {} as ExecutionContext);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ intro: "", site_name: "", avatar_url: "" });
  });

  it("PUT /api/site 只更新传入字段", async () => {
    const settings = new Map([["intro", "旧自我介绍"]]);
    const env = makeEnv(settings);
    const res = await worker.fetch(
      new Request("https://example.com/api/site", {
        method: "PUT",
        body: JSON.stringify({ site_name: "新名字", avatar_url: "https://example.com/b.png" }),
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        },
      }),
      env,
      {} as ExecutionContext
    );
    expect(res.status).toBe(200);
    expect(settings.get("intro")).toBe("旧自我介绍");
    expect(settings.get("site_name")).toBe("新名字");
    expect(settings.get("avatar_url")).toBe("https://example.com/b.png");
  });
});
