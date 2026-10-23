/**
 * Reads a JSON request body up to maxBytes. The declared Content-Length is checked first so an
 * oversized body is refused before it is read; the actual size is checked again after reading.
 */
export async function readJsonBody(
  request: Request,
  maxBytes: number,
): Promise<{ value: unknown } | "too_large" | "invalid"> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    return "too_large";
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) {
    return "too_large";
  }
  try {
    return { value: JSON.parse(text) as unknown };
  } catch {
    return "invalid";
  }
}
