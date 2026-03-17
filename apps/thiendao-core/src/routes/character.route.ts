import { createRoute } from "@hono/zod-openapi";
import {
  CreateCharacterRequestSchema,
  CreateCharacterResponseSchema,
} from "../schemas/character.schema.js";
import { ErrorResponseSchema } from "../schemas/story.schema.js";

// ─── POST /api/characters — Create Character ────────────────────

export const createCharacterRoute = createRoute({
  method: "post",
  path: "/api/characters",
  tags: ["🧙 Characters"],
  summary: "Create Character",
  description:
    "Tạo nhân vật tu tiên mới. " +
    "Nếu không truyền attributes, hệ thống sẽ khởi tạo mặc định (10 cho mỗi chỉ số).",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: CreateCharacterRequestSchema,
        },
      },
      description: "Thông tin nhân vật mới",
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: CreateCharacterResponseSchema,
        },
      },
      description: "Nhân vật đã được tạo thành công",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Dữ liệu gửi lên không hợp lệ",
    },
  },
});
