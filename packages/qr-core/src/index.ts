const TOKEN_PATTERN = /^qr_[A-Za-z0-9_-]{24,96}$/;

export function isQrToken(value: string): boolean {
  return TOKEN_PATTERN.test(value);
}

export function qrRoute(baseUrl: string, token: string): string {
  if (!isQrToken(token)) throw new Error('Token QR inválido.');
  return new URL(`/api/q/${encodeURIComponent(token)}`, baseUrl).toString();
}

export function extractQrToken(value: string): string | null {
  try {
    const url = new URL(value);
    const match = url.pathname.match(/\/api\/q\/(qr_[A-Za-z0-9_-]{24,96})$/);
    return match?.[1] ?? null;
  } catch {
    return isQrToken(value) ? value : null;
  }
}
