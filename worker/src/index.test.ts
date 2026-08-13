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
      fetch: (input: RequestInfo | URL) => {
        const url =
          typeof input === "string"
            ? new URL(input, "https://assets")
            : input instanceof URL
              ? input
              : new URL(input.url);
        if (url.pathname === "/assets/xyz.js") {
          return new Response("console.log('asset')", {
            status: 200,
            headers: { "Content-Type": "application/javascript" },
          });
        }
        return new Response(
          "<!doctype html><html><head><title>个人博客</title></head><body></body></html>",
          {
            status: 200,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          }
        );
      },
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

  it("site_name 含 HTML 特殊字符时正确转义", async () => {
    const res = await worker.fetch(
      new Request("https://example.com/", { headers: { Accept: "text/html" } }),
      makeEnv('<b>&"'),
      {} as ExecutionContext
    );
    const html = await res.text();
    expect(html).toContain("<title>&lt;b&gt;&amp;&quot;</title>");
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

  it("静态资源请求转发到 ASSETS，不经过 HTML 改写", async () => {
    const res = await worker.fetch(
      new Request("https://example.com/assets/xyz.js"),
      makeEnv(),
      {} as ExecutionContext
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("console.log('asset')");
    expect(res.headers.get("Content-Type")).toBe("application/javascript");
  });
});
