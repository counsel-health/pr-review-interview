/**
 * Tiny HTTP helpers for App Router Route Handlers. Keeps every JSON response
 * shaped the same way across routes.
 */

export interface ErrorEnvelope {
  error: { code: string; message: string };
}

export function jsonResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function errorResponse(
  code: string,
  message: string,
  status = 500
): Response {
  const body: ErrorEnvelope = { error: { code, message } };
  return jsonResponse(body, status);
}

export async function parseJsonBody<T>(req: Request): Promise<T> {
  const text = await req.text();
  if (!text) throw new Error("empty request body");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("invalid JSON body");
  }
}
