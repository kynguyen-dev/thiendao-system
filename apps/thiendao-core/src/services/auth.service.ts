import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import * as dotenv from "dotenv";

dotenv.config();

// ─── Configuration ──────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET || "thiendao-secret-key-change-in-production";
const JWT_EXPIRES_IN = "7d";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const BCRYPT_ROUNDS = 10;

const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

// ─── Password Hashing ──────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── JWT ────────────────────────────────────────────────────────

export interface JWTPayload {
  userId: string;
  email: string;
}

export function generateJWT(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyJWT(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

// ─── Google OAuth ───────────────────────────────────────────────

export interface GoogleUserInfo {
  googleId: string;
  email: string;
  name: string;
  picture: string;
}

export async function verifyGoogleToken(idToken: string): Promise<GoogleUserInfo> {
  if (!googleClient) {
    throw new Error("Google OAuth is not configured. Set GOOGLE_CLIENT_ID in .env");
  }

  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload) {
    throw new Error("Invalid Google token: no payload");
  }

  return {
    googleId: payload.sub,
    email: payload.email ?? "",
    name: payload.name || (payload.email ?? "").split("@")[0],
    picture: payload.picture || "",
  };
}
