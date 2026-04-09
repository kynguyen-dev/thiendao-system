import { z } from "@hono/zod-openapi";

// ─── Novel (Truyện) ──────────────────────────────────────────────

export const CreateNovelRequestSchema = z.object({
  title: z.string().min(1).max(500).openapi({ example: "Phàm Nhân Tu Tiên", description: "Tên truyện" }),
  synopsis: z.string().optional().openapi({ example: "Một thiếu niên bình thường..." }),
  coverImageUrl: z.string().url().optional().openapi({ description: "Link ảnh bìa" }),
  genre: z.string().optional().openapi({ example: "Tiên Hiệp" }),
  tags: z.array(z.string()).optional().openapi({ example: ["Cẩu Đạo", "Hệ Thống"] }),
}).openapi("CreateNovelRequest");

export const NovelResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    id: z.string(),
    authorId: z.string(),
    title: z.string(),
    synopsis: z.string().nullable().optional(),
    coverImageUrl: z.string().nullable().optional(),
    genre: z.string().nullable().optional(),
    tags: z.array(z.string()).nullable().optional(),
    status: z.enum(["draft", "published", "completed"]),
    viewCount: z.number(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
}).openapi("NovelResponse");

export const NovelsListResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(
    z.object({
      id: z.string(),
      authorId: z.string(),
      title: z.string(),
      coverImageUrl: z.string().nullable().optional(),
      genre: z.string().nullable().optional(),
      status: z.string(),
      viewCount: z.number(),
    })
  )
}).openapi("NovelsListResponse");

// ─── Chapter (Chương Truyện) ─────────────────────────────────────

export const CreateChapterRequestSchema = z.object({
  title: z.string().min(1).max(500).openapi({ example: "Chương 1: Yến Tộc Kỳ Tài" }),
  content: z.string().min(1).openapi({ example: "Tại mảnh đại lục này..." }),
  isPublished: z.number().int().min(0).max(1).optional().openapi({ example: 0, description: "0: Nháp, 1: Đã xuất bản" }),
}).openapi("CreateChapterRequest");

export const ChapterResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    id: z.string(),
    storyId: z.string(),
    chapterNumber: z.number(),
    title: z.string().nullable().optional(),
    content: z.string(),
    wordCount: z.number(),
    isPublished: z.number(),
    createdAt: z.string(),
  }),
}).openapi("ChapterResponse");

// ─── AI Assist (Gemini Writer) ───────────────────────────────────

export const AIAssistRequestSchema = z.object({
  prompt: z.string().min(1).max(5000).openapi({ example: "Lâm Phong gặp kẻ thù, lật ngược thế cờ..." }),
}).openapi("AIAssistRequest");

export const AIAssistResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    generatedText: z.string(),
  }),
}).openapi("AIAssistResponse");
