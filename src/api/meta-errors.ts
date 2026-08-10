import type { Response } from "express";

/**
 * Meta Graph API error envelope — matches graph.facebook.com responses.
 * FeedGraph checks body.error.message / body.error.code / body.error.type.
 */
export class MetaGraphError extends Error {
  status: number;
  code: number;
  type: string;
  errorSubcode?: number;
  fbtraceId: string;

  constructor(
    message: string,
    opts?: { status?: number; code?: number; type?: string; errorSubcode?: number },
  ) {
    super(message);
    this.name = "MetaGraphError";
    this.status = opts?.status ?? 400;
    this.code = opts?.code ?? 100;
    this.type = opts?.type ?? "OAuthException";
    this.errorSubcode = opts?.errorSubcode;
    this.fbtraceId = `sandbox_${Date.now().toString(36)}`;
  }
}

export function metaErrorBody(err: MetaGraphError) {
  const error: Record<string, unknown> = {
    message: err.message,
    type: err.type,
    code: err.code,
    fbtrace_id: err.fbtraceId,
  };
  if (err.errorSubcode != null) error.error_subcode = err.errorSubcode;
  return { error };
}

export function handleMetaError(res: Response, err: unknown): void {
  if (err instanceof MetaGraphError) {
    res.status(err.status).json(metaErrorBody(err));
    return;
  }
  const message = err instanceof Error ? err.message : "Unknown error";
  const wrapped = new MetaGraphError(message, { status: 500, code: 1, type: "GraphMethodException" });
  res.status(500).json(metaErrorBody(wrapped));
}

export function notFoundHandler(_req: unknown, res: Response): void {
  const err = new MetaGraphError(
    "(#803) Some of the aliases you requested do not exist: unknown",
    { status: 404, code: 803, type: "OAuthException" },
  );
  res.status(404).json(metaErrorBody(err));
}
