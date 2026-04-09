import { z } from "@hono/zod-openapi";

// ─── Register ───────────────────────────────────────────────────

export const RegisterRequestSchema = z
  .object({
    username: z.string().min(3).max(50).openapi({
      example: "lamphong",
      description: "Tên tài khoản (3-50 ký tự)",
    }),
    email: z.string().email().openapi({
      example: "lamphong@thiendao.vn",
      description: "Địa chỉ email",
    }),
    password: z.string().min(6).openapi({
      example: "matkhau123",
      description: "Mật khẩu (tối thiểu 6 ký tự)",
    }),
  })
  .openapi("RegisterRequest");

// ─── Login ──────────────────────────────────────────────────────

export const LoginRequestSchema = z
  .object({
    email: z.string().email().openapi({
      example: "lamphong@thiendao.vn",
      description: "Địa chỉ email",
    }),
    password: z.string().min(1).openapi({
      example: "matkhau123",
      description: "Mật khẩu",
    }),
  })
  .openapi("LoginRequest");

// ─── Google Auth ────────────────────────────────────────────────

export const GoogleAuthRequestSchema = z
  .object({
    idToken: z.string().openapi({
      description: "Google ID token từ frontend Google Sign-In",
    }),
  })
  .openapi("GoogleAuthRequest");

// ─── Auth Response ──────────────────────────────────────────────

export const AuthResponseSchema = z
  .object({
    success: z.boolean().openapi({ example: true }),
    message: z.string().openapi({ example: "Đăng nhập thành công" }),
    data: z
      .object({
        token: z.string().openapi({ example: "eyJhbGciOiJIUzI1NiIs..." }),
        user: z.object({
          id: z.string(),
          username: z.string(),
          email: z.string(),
          displayName: z.string().nullable(),
          avatarUrl: z.string().nullable(),
          bio: z.string().nullable(),
          authProvider: z.enum(["local", "google"]),
          tuVi: z.number().openapi({ example: 100 }),
          linhThach: z.number().openapi({ example: 50 }),
          createdAt: z.string(),
        }),
      })
      .optional(),
  })
  .openapi("AuthResponse");

// ─── Update Profile Request ──────────────────────────────────────

export const UpdateProfileRequestSchema = z
  .object({
    displayName: z.string().max(50).nullable().optional(),
    bio: z.string().max(500).nullable().optional(),
    avatarUrl: z.string().url().nullable().optional(),
  })
  .openapi("UpdateProfileRequest");

// ─── User Profile Response ──────────────────────────────────────

export const UserProfileSchema = z
  .object({
    success: z.boolean(),
    data: z.object({
      id: z.string(),
      username: z.string(),
      email: z.string(),
      displayName: z.string().nullable(),
      avatarUrl: z.string().nullable(),
      bio: z.string().nullable(),
      authProvider: z.enum(["local", "google"]),
      tuVi: z.number(),
      linhThach: z.number(),
      createdAt: z.string(),
    }),
  })
  .openapi("UserProfile");
