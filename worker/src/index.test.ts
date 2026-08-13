import { describe, it, expect } from "vitest";
import worker from "./index";

function makeEnv(siteName?: string) {
  return {
    DB: {
      prepare: () => ({
        bind: () => ({
          first: async (col: string) => (col === "value" ? siteName ?? null : null),
        }),
      }),
    } as unknown as D1Database,
    SESSIONS: {} as unknown as KVNamespace,
    ASSETS: {
      fetch: () =>
        new Response("<!doctype html><html><head><title>个人博客</title></head><body></body></html>", {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }),
    } as unknown as Fetcher,
  };
}

describe("worker fetch", () => {
  it("GET / 使用已配置站点名作为 title", async () => {
    const res = await worker.fetch(
      new Request("https://example.com/", { headers: { Accept: "text/html" } }),
      makeEnv("小明博客"),
      {} as ExecutionContext
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("<title>小明博客</title>");
    expect(html).not.toContain("<title>个人博客</title>");
  });

  it("site_name 为空时回退默认个人博客", async () => {
    const res = await worker.fetch(
      new Request("https://example.com/", { headers: { Accept: "text/html" } }),
      makeEnv(""),
      {} as ExecutionContext
    );
    const html = await res.text();
    expect(html).toContain("<title>个人博客</title>");
  });

  it("未匹配的 api 请求返回 404 JSON", async () => {
    const res = await worker.fetch(
      new Request("https://example.com/api/unknown"),
      makeEnv(),
      {} as ExecutionContext
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not Found" });
  });
});
