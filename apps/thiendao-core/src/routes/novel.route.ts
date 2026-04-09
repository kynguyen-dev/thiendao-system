import { createRoute, z } from "@hono/zod-openapi";
import {
  CreateNovelRequestSchema,
  NovelResponseSchema,
  NovelsListResponseSchema,
  CreateChapterRequestSchema,
  ChapterResponseSchema,
  AIAssistRequestSchema,
  AIAssistResponseSchema,
} from "../schemas/novel.schema.js";

const ErrorSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  error: z.string().optional(),
}).openapi("NovelError");

export const createNovelRoute = createRoute({
  method: "post",
  path: "/api/novels",
  tags: ["📚 Tàng Kinh Các (Web Novel)"],
  summary: "Khai tông lập phái (Tạo truyện mới)",
  description: "Cho phép tác giả tạo một bộ truyện / tác phẩm mới.",
  security: [{ BearerAuth: [] }],
  request: {
    body: { required: true, content: { "application/json": { schema: CreateNovelRequestSchema } } },
  },
  responses: {
    201: { content: { "application/json": { schema: NovelResponseSchema } }, description: "Tạo truyện thành công" },
    400: { content: { "application/json": { schema: ErrorSchema } }, description: "Dữ liệu không hợp lệ" },
    401: { content: { "application/json": { schema: ErrorSchema } }, description: "Chưa đăng nhập" },
  },
});

export const getMyNovelsRoute = createRoute({
  method: "get",
  path: "/api/novels/my",
  tags: ["📚 Tàng Kinh Các (Web Novel)"],
  summary: "Tác phẩm của tôi",
  description: "Lấy danh sách các truyện do user login hiện hành sáng tác.",
  security: [{ BearerAuth: [] }],
  responses: {
    200: { content: { "application/json": { schema: NovelsListResponseSchema } }, description: "Thành công" },
    401: { content: { "application/json": { schema: ErrorSchema } }, description: "Chưa đăng nhập" },
  },
});

export const createChapterRoute = createRoute({
  method: "post",
  path: "/api/novels/{novelId}/chapters",
  tags: ["📖 Chương Truyện (Chapters)"],
  summary: "Thêm chương mới",
  description: "Cập nhật thêm nội dung chương truyện mới (yêu cầu quyền tác giả).",
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({ novelId: z.string().openapi({ description: "ID của bộ truyện" }) }),
    body: { required: true, content: { "application/json": { schema: CreateChapterRequestSchema } } },
  },
  responses: {
    201: { content: { "application/json": { schema: ChapterResponseSchema } }, description: "Thêm chương thành công" },
    400: { content: { "application/json": { schema: ErrorSchema } }, description: "Dữ liệu không hợp lệ" },
    401: { content: { "application/json": { schema: ErrorSchema } }, description: "Chưa đăng nhập hoặc không phải tác giả" },
  },
});

export const aiAssistRoute = createRoute({
  method: "post",
  path: "/api/novels/{novelId}/ai-assist",
  tags: ["📖 Chương Truyện (Chapters)"],
  summary: "Đạo Các (AI Trợ Giúp)",
  description: "Trợ lý ảo Gemini hỗ trợ viết văn phong Tiên Hiệp dựa trên ý tưởng của tác giả.",
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({ novelId: z.string() }),
    body: { required: true, content: { "application/json": { schema: AIAssistRequestSchema } } },
  },
  responses: {
    200: { content: { "application/json": { schema: AIAssistResponseSchema } }, description: "Thành công" },
    400: { content: { "application/json": { schema: ErrorSchema } }, description: "Lỗi" },
    401: { content: { "application/json": { schema: ErrorSchema } }, description: "Chưa đăng nhập" },
  },
});
