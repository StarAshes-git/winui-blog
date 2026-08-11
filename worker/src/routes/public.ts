import { Hono } from "hono";
import type { Env } from "../index";

export const publicApi = new Hono<{ Bindings: Env }>();
