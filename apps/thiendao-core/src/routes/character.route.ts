import { createRoute } from "@hono/zod-openapi";
import {
  CreateCharacterRequestSchema,
  CreateCharacterResponseSchema,
  GetCharactersResponseSchema,
  DeleteCharacterResponseSchema,
} from "../schemas/character.schema.js";
import { ErrorResponseSchema } from "../schemas/story.schema.js";
import { z } from "@hono/zod-openapi";

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

// ─── GET /api/characters ────────────────────────────────────────

export const getCharactersRoute = createRoute({
  method: "get",
  path: "/api/characters",
  tags: ["🧙 Characters"],
  summary: "Danh sách nhân vật",
  description: "Lấy danh sách tất cả các nhân vật đã tạo, sắp xếp theo thời gian mới nhất.",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: GetCharactersResponseSchema,
        },
      },
      description: "Lấy danh sách thành công",
    },
    500: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Lỗi máy chủ",
    },
  },
});

// ─── DELETE /api/characters/:id ─────────────────────────────────

export const deleteCharacterRoute = createRoute({
  method: "delete",
  path: "/api/characters/{id}",
  tags: ["🧙 Characters"],
  summary: "Xóa nhân vật",
  description: "Xóa vĩnh viễn nhân vật và toàn bộ diễn biến câu chuyện liên quan.",
  request: {
    params: z.object({
      id: z.string().openapi({ example: "cuid123", description: "Mã NV" }),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: DeleteCharacterResponseSchema,
        },
      },
      description: "Xóa thành công",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Lỗi dữ liệu hoặc nhân vật không tồn tại",
    },
  },
});
