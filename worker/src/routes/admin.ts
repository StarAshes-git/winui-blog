import { Hono } from "hono";
import type { Env } from "../index";

export const adminApi = new Hono<{ Bindings: Env }>();
