import type { PagedPosts, PostDetail, PostSummary, SiteInfo, TagCount } from "./types";

const TOKEN_KEY = "blog_token";

let token: string | null = localStorage.getItem(TOKEN_KEY);

export function setToken(t: string | null): void {
  token = t;
  if (t) {
    localStorage.setItem(TOKEN_KEY, t);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getToken(): string | null {
  return token;
}

export type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler = () => {};
export function setUnauthorizedHandler(handler: UnauthorizedHandler): void {
  onUnauthorized = handler;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`/api${path}`, { ...init, headers });
  if (res.status === 401) {
    setToken(null);
    onUnauthorized();
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((body as { error?: string })?.error ?? "请求失败");
  }
  return body as T;
}

export const client = {
  getSite: () => request<SiteInfo>("/site"),
  listPosts: (params?: { tag?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.tag) q.set("tag", params.tag);
    if (params?.page) q.set("page", String(params.page));
    if (params?.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    return request<PagedPosts>(`/posts${qs ? `?${qs}` : ""}`);
  },
  getPost: (id: number) => request<PostDetail>(`/posts/${id}`),
  getTags: () => request<TagCount[]>("/tags"),
  login: (password: string) =>
    request<{ token: string }>("/login", { method: "POST", body: JSON.stringify({ password }) }),
  logout: () => request<{ ok: boolean }>("/logout", { method: "POST" }),
  updateSite: (intro: string) =>
    request<{ ok: boolean }>("/site", { method: "PUT", body: JSON.stringify({ intro }) }),
  createPost: (body: { title: string; content: string; tags: string[] }) =>
    request<{ id: number }>("/posts", { method: "POST", body: JSON.stringify(body) }),
  updatePost: (id: number, body: { title: string; content: string; tags: string[] }) =>
    request<{ ok: boolean }>(`/posts/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deletePost: (id: number) => request<{ ok: boolean }>(`/posts/${id}`, { method: "DELETE" }),
  changePassword: (oldPassword: string, newPassword: string) =>
    request<{ ok: boolean }>("/change-password", {
      method: "POST",
      body: JSON.stringify({ oldPassword, newPassword }),
    }),
};
