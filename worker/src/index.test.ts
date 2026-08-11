import { describe, it, expect } from "vitest";
import worker from "./index";

function makeEnv() {
  return {
    DB: {} as unknown as D1Database,
    SESSIONS: {} as unknown as KVNamespace,
    ASSETS: {
      fetch: (request: Request) => new Response("asset-mock", { status: 200 }),
    } as unknown as Fetcher,
  };
}

describe("worker fetch", () => {
  it("转发非 api 请求到 ASSETS", async () => {
    const res = await worker.fetch(
      new Request("https://example.com/"),
      makeEnv(),
      {} as ExecutionContext
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("asset-mock");
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
