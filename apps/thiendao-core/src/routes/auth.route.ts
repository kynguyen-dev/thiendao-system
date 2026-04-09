import { createRoute } from "@hono/zod-openapi";
import {
  RegisterRequestSchema,
  LoginRequestSchema,
  GoogleAuthRequestSchema,
  AuthResponseSchema,
  UpdateProfileRequestSchema,
  UserProfileSchema,
} from "../schemas/auth.schema.js";
import { z } from "@hono/zod-openapi";

const ErrorSchema = z.object({
  success: z.boolean(),
  message: z.string(),
}).openapi("AuthError");

// ─── POST /api/auth/register ────────────────────────────────────

export const registerRoute = createRoute({
  method: "post",
  path: "/api/auth/register",
  tags: ["🔐 Auth"],
  summary: "Đăng ký tài khoản",
  description: "Tạo tài khoản mới bằng email và mật khẩu.",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: RegisterRequestSchema } },
    },
  },
  responses: {
    201: {
      content: { "application/json": { schema: AuthResponseSchema } },
      description: "Đăng ký thành công",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Email/username đã tồn tại hoặc dữ liệu không hợp lệ",
    },
  },
});

// ─── POST /api/auth/login ───────────────────────────────────────

export const loginRoute = createRoute({
  method: "post",
  path: "/api/auth/login",
  tags: ["🔐 Auth"],
  summary: "Đăng nhập",
  description: "Đăng nhập bằng email và mật khẩu.",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: LoginRequestSchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: AuthResponseSchema } },
      description: "Đăng nhập thành công",
    },
    401: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Email hoặc mật khẩu không đúng",
    },
  },
});

// ─── POST /api/auth/google ──────────────────────────────────────

export const googleAuthRoute = createRoute({
  method: "post",
  path: "/api/auth/google",
  tags: ["🔐 Auth"],
  summary: "Đăng nhập bằng Google",
  description: "Đăng nhập hoặc đăng ký bằng Google ID token.",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: GoogleAuthRequestSchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: AuthResponseSchema } },
      description: "Đăng nhập Google thành công",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Token không hợp lệ",
    },
  },
});

// ─── GET /api/auth/me ───────────────────────────────────────────

export const meRoute = createRoute({
  method: "get",
  path: "/api/auth/me",
  tags: ["🔐 Auth"],
  summary: "Thông tin tài khoản",
  description: "Lấy thông tin user hiện tại từ JWT token.",
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      content: { "application/json": { schema: UserProfileSchema } },
      description: "Thành công",
    },
    401: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Chưa đăng nhập",
    },
  },
});

// ─── PUT /api/auth/profile ──────────────────────────────────────────

export const updateProfileRoute = createRoute({
  method: "put",
  path: "/api/auth/profile",
  tags: ["🔐 Auth"],
  summary: "Cập nhật hồ sơ",
  description: "Cập nhật bút danh, hình đại diện và bio.",
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: UpdateProfileRequestSchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: UserProfileSchema } },
      description: "Thành công",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Dữ liệu không hợp lệ",
    },
    401: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Chưa đăng nhập",
    },
  },
});
