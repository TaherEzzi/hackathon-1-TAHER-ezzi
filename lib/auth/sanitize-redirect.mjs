const DEFAULT = "/the-house.html";

/** @param {string | null | undefined} next */
export function sanitizeAuthRedirect(next) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return DEFAULT;
  return next;
}
