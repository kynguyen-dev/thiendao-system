import { createRoute } from "@hono/zod-openapi";
import {
  StoryNextRequestSchema,
  StoryNextResponseSchema,
  GetStoryLatestResponseSchema,
  GetStoryHistoryResponseSchema,
  HealthCheckResponseSchema,
  ErrorResponseSchema,
} from "../schemas/story.schema.js";
import { z } from "@hono/zod-openapi";

// ─── GET / — Health Check ───────────────────────────────────────

export const healthCheckRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["⚙️ System"],
  summary: "Health Check",
  description: "Kiểm tra trạng thái hoạt động của Thiên Đạo Core API.",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: HealthCheckResponseSchema,
        },
      },
      description: "API đang hoạt động bình thường",
    },
  },
});

// ─── POST /api/story/next — Advance Story ───────────────────────

export const storyNextRoute = createRoute({
  method: "post",
  path: "/api/story/next",
  tags: ["📖 Story"],
  summary: "Advance Story",
  description:
    "Gửi hành động của người chơi để nhận node truyện tiếp theo. " +
    "AI sẽ sinh ra nội dung mới dựa trên lựa chọn và lịch sử hành trình tu tiên.",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: StoryNextRequestSchema,
        },
      },
      description: "Thông tin hành động của người chơi",
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: StoryNextResponseSchema,
        },
      },
      description: "Node truyện tiếp theo đã được sinh thành công",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Dữ liệu gửi lên không hợp lệ",
    },
    429: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Thiên Đạo tạm thời quá tải — đã vượt giới hạn API",
    },
  },
});

// ─── GET /api/story/:characterId/latest ─────────────────────────

export const getStoryLatestRoute = createRoute({
  method: "get",
  path: "/api/story/{characterId}/latest",
  tags: ["📖 Story"],
  summary: "Get Latest Story Node",
  description: "Lấy node truyện gần nhất của nhân vật để hiển thị tiếp.",
  request: {
    params: z.object({
      characterId: z.string().openapi({ example: "cuid123", description: "Mã NV" }),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: GetStoryLatestResponseSchema,
        },
      },
      description: "Lấy node thành công",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Lỗi",
    },
  },
});

// ─── GET /api/story/:characterId ────────────────────────────────

export const getStoryRoute = createRoute({
  method: "get",
  path: "/api/story/{characterId}",
  tags: ["📖 Story"],
  summary: "Get Story History",
  description: "Lấy toàn bộ lịch sử các node truyện của một nhân vật.",
  request: {
    params: z.object({
      characterId: z.string().openapi({ example: "cuid123", description: "Mã NV" }),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: GetStoryHistoryResponseSchema,
        },
      },
      description: "Lấy lịch sử thành công",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Lỗi",
    },
  },
});
