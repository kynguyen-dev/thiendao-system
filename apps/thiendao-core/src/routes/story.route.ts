import { createRoute } from "@hono/zod-openapi";
import {
  StoryNextRequestSchema,
  StoryNextResponseSchema,
  HealthCheckResponseSchema,
  ErrorResponseSchema,
} from "../schemas/story.schema.js";

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
