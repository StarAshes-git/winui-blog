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
          if (m) {
            settings.set(m[1], params[0] as string);
            return { meta: { changes: 1, last_row_id: 1 } };
          }
          const del = /DELETE FROM settings WHERE key = \?/.exec(sql);
          if (del) {
            const key = params[0] as string;
            const existed = settings.has(key);
            settings.delete(key);
            return { meta: { changes: existed ? 1 : 0, last_row_id: 0 } };
          }
          return { meta: { changes: 0, last_row_id: 0 } };
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
      footer_record: null,
    });
  });

  it("GET /api/site 未设置字段返回空串", async () => {
    const env = makeEnv(new Map());
    const res = await worker.fetch(new Request("https://example.com/api/site"), env, {} as ExecutionContext);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ intro: "", site_name: "", avatar_url: "", footer_record: null });
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

describe("footer_record", () => {
  it("GET /api/site 返回 footer_record（未配置时为 null）", async () => {
    const env = makeEnv(new Map());
    const res = await worker.fetch(new Request("https://example.com/api/site"), env, {} as ExecutionContext);
    expect((await res.json() as { footer_record: unknown }).footer_record).toBeNull();
  });

  it("PUT /api/site 写入 footer_record 后可读回", async () => {
    const settings = new Map();
    const env = makeEnv(settings);
    const put = await worker.fetch(
      new Request("https://example.com/api/site", {
        method: "PUT",
        body: JSON.stringify({ footer_record: { text: "京ICP备12345678号", link: "https://beian.miit.gov.cn/" } }),
        headers: { "Content-Type": "application/json", Authorization: "Bearer test-token" },
      }),
      env,
      {} as ExecutionContext
    );
    expect(put.status).toBe(200);
    const stored = settings.get("footer_record");
    expect(JSON.parse(stored)).toEqual({ text: "京ICP备12345678号", link: "https://beian.miit.gov.cn/" });

    const get = await worker.fetch(new Request("https://example.com/api/site"), env, {} as ExecutionContext);
    expect(await get.json()).toMatchObject({ footer_record: { text: "京ICP备12345678号", link: "https://beian.miit.gov.cn/" } });
  });

  it("PUT /api/site 非法 link 返回 400", async () => {
    const env = makeEnv(new Map());
    const res = await worker.fetch(
      new Request("https://example.com/api/site", {
        method: "PUT",
        body: JSON.stringify({ footer_record: { text: "X", link: "javascript:alert(1)" } }),
        headers: { "Content-Type": "application/json", Authorization: "Bearer test-token" },
      }),
      env,
      {} as ExecutionContext
    );
    expect(res.status).toBe(400);
  });

  it("PUT /api/site footer_record 传 null 清除", async () => {
    const settings = new Map([["footer_record", JSON.stringify({ text: "A", link: "https://a.com" })]]);
    const env = makeEnv(settings);
    const res = await worker.fetch(
      new Request("https://example.com/api/site", {
        method: "PUT",
        body: JSON.stringify({ footer_record: null }),
        headers: { "Content-Type": "application/json", Authorization: "Bearer test-token" },
      }),
      env,
      {} as ExecutionContext
    );
    expect(res.status).toBe(200);
    expect(settings.has("footer_record")).toBe(false);
  });
});
