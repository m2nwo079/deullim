import "server-only";
import { encode } from "uqr";

/**
 * QR modules for a URL, without the quiet zone (QrCode draws it).
 * Runs on the server only, so the QR library never ships to the browser.
 */
export function qrMatrix(text: string): boolean[][] {
  return encode(text, { ecc: "M", border: 0 }).data;
}
