import type { Context, Next } from "hono";
import { verifyJWT } from "../services/auth.service.js";

// ─── Auth Middleware ────────────────────────────────────────────
// Extracts JWT from Authorization header, verifies it, and sets
// userId + email on the Hono context variables.
//
// Usage:
//   app.use("/api/protected/*", authMiddleware);
//   // then in handler: const userId = c.get("userId");
// ────────────────────────────────────────────────────────────────

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json(
      { success: false, message: "Chưa đăng nhập. Vui lòng đăng nhập để tiếp tục." },
      401
    );
  }

  const token = authHeader.slice(7); // Remove "Bearer "

  try {
    const payload = verifyJWT(token);
    c.set("userId", payload.userId);
    c.set("email", payload.email);
    await next();
  } catch (error) {
    return c.json(
      { success: false, message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." },
      401
    );
  }
}

// ─── Optional Auth Middleware ───────────────────────────────────
// Same as above, but does NOT reject unauthenticated requests.
// If token is valid, sets userId/email. If not, continues anyway.
// Useful for public endpoints that optionally benefit from auth.
// ────────────────────────────────────────────────────────────────

export async function optionalAuthMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const payload = verifyJWT(token);
      c.set("userId", payload.userId);
      c.set("email", payload.email);
    } catch {
      // Token invalid — that's fine for optional auth
    }
  }

  await next();
}
