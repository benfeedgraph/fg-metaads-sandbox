import type { NextFunction, Request, Response } from "express";
import { config } from "../config.js";
import { MetaGraphError, handleMetaError } from "./meta-errors.js";

/** Extract access_token from Bearer header, query, or JSON/form body (Meta accepts all three). */
export function extractAccessToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const t = auth.slice(7).trim();
    if (t) return t;
  }
  const q = req.query.access_token;
  if (typeof q === "string" && q.trim()) return q.trim();
  const body = req.body as { access_token?: unknown } | undefined;
  if (body && typeof body.access_token === "string" && body.access_token.trim()) {
    return body.access_token.trim();
  }
  return null;
}

export function sandboxAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const token = extractAccessToken(req);
    if (!token) {
      throw new MetaGraphError("Invalid OAuth access token - Cannot parse access token", {
        status: 401,
        code: 190,
        type: "OAuthException",
        errorSubcode: 463,
      });
    }
    if (token !== config.accessToken) {
      throw new MetaGraphError("Invalid OAuth access token.", {
        status: 401,
        code: 190,
        type: "OAuthException",
      });
    }
    next();
  } catch (err) {
    handleMetaError(res, err);
  }
}

/** Soft auth for oauth/access_token exchange — validates app credentials instead. */
export function validateAppCredentials(clientId: string, clientSecret: string): void {
  if (clientId !== config.appId || clientSecret !== config.appSecret) {
    throw new MetaGraphError("Error validating client secret.", {
      status: 400,
      code: 1,
      type: "OAuthException",
    });
  }
}
