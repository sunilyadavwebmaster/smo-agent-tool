// lib/auth.js
//
// Minimal password gate. No user accounts/database — one shared password
// (TOOL_PASSWORD env var) protects the whole tool, since it's calling
// paid APIs (Apify) on your behalf. The cookie is an HMAC of a fixed
// string using TOOL_PASSWORD as the key, so it can't be forged without
// knowing the password, but there's no session store to manage.

import crypto from "crypto";

const COOKIE_NAME = "cag_auth";

function getPassword() {
  const pw = process.env.TOOL_PASSWORD;
  if (!pw) throw new Error("TOOL_PASSWORD is not set. Add it in your Vercel project's Environment Variables.");
  return pw;
}

export function makeToken() {
  return crypto.createHmac("sha256", getPassword()).update("authenticated").digest("hex");
}

export function checkPassword(candidate) {
  const pw = getPassword();
  const a = Buffer.from(candidate || "");
  const b = Buffer.from(pw);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function parseCookies(header) {
  const out = {};
  (header || "").split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  });
  return out;
}

export function isAuthenticated(req) {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[COOKIE_NAME];
    if (!token) return false;
    const expected = makeToken();
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// For API routes: returns true and does nothing if authenticated; sends a
// 401 JSON response and returns false otherwise.
export function requireAuth(req, res) {
  if (isAuthenticated(req)) return true;
  res.status(401).json({ error: "Not authenticated" });
  return false;
}

export function setAuthCookie(res) {
  const token = makeToken();
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`
  );
}

export function clearAuthCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export { COOKIE_NAME };
