import { describe, it, expect } from "vitest";
import {
  setIntro,
  getSiteIntro,
  getSiteName,
  setSiteName,
  getAvatarUrl,
  setAvatarUrl,
  createPost,
  listPosts,
  getPost,
  incrementViews,
  updatePost,
  deletePost,
  listTags,
  setPassword,
  getStoredPassword,
} from "./db";
import type { Env } from "./index";

describe("db 模块边界", () => {
  it("db.ts 存在且导出所需函数", () => {
    expect(typeof setIntro).toBe("function");
    expect(typeof getSiteIntro).toBe("function");
    expect(typeof createPost).toBe("function");
    expect(typeof listPosts).toBe("function");
    expect(typeof getPost).toBe("function");
    expect(typeof incrementViews).toBe("function");
    expect(typeof updatePost).toBe("function");
    expect(typeof deletePost).toBe("function");
    expect(typeof listTags).toBe("function");
    expect(typeof setPassword).toBe("function");
    expect(typeof getStoredPassword).toBe("function");
    expect(typeof getSiteName).toBe("function");
    expect(typeof setSiteName).toBe("function");
    expect(typeof getAvatarUrl).toBe("function");
    expect(typeof setAvatarUrl).toBe("function");
  });
});