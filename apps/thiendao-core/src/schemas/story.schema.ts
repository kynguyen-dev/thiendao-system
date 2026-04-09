import { z } from "@hono/zod-openapi";

// ─── Story Choice Schema ────────────────────────────────────────

export const StoryChoiceSchema = z
  .object({
    label: z.string().openapi({ example: "Luyện kiếm tại Huyền Thiên Phong" }),
    action: z.string().openapi({ example: "train_sword_peak" }),
  })
  .openapi("StoryChoice");

// ─── Story Next — Request Body ──────────────────────────────────

export const StoryNextRequestSchema = z
  .object({
    characterId: z
      .string()
      .min(1)
      .openapi({
        example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        description: "ID nhân vật đang chơi",
      }),
    previousNodeId: z
      .string()
      .optional()
      .openapi({
        example: "node-abc-123",
        description: "ID node truyện trước đó (bỏ trống nếu bắt đầu mới)",
      }),
    actionTaken: z
      .string()
      .optional()
      .openapi({
        example: "enter_peak",
        description: "Hành động người chơi đã chọn ở node trước",
      }),
  })
  .openapi("StoryNextRequest");

// ─── Story Next — Response Body ─────────────────────────────────

export const StoryNextResponseSchema = z
  .object({
    success: z.boolean().openapi({ example: true }),
    message: z
      .string()
      .openapi({ example: "Story node generated successfully" }),
    data: z
      .object({
        id: z.string().openapi({ example: "node-next-456" }),
        content: z.string().openapi({
          example:
            "Con đường phía trước chia làm hai ngả. Bên trái là Huyền Thiên Phong...",
        }),
        choices: z.array(StoryChoiceSchema),
        statChanges: z
          .record(z.string(), z.number())
          .openapi({
            example: {
              strength: 2,
              intelligence: -1,
              charisma: 0,
              luck: 1,
            },
            description: "Thay đổi chỉ số nhân vật sau node này",
          }),
        updatedAttributes: z
          .record(z.string(), z.number())
          .openapi({
            example: {
              strength: 12,
              intelligence: 9,
              charisma: 10,
              luck: 11,
            },
            description: "Chỉ số nhân vật sau khi cập nhật",
          }),
      })
      .openapi("StoryNodeData"),
  })
  .openapi("StoryNextResponse");

// ─── Story Latest — Response Body ─────────────────────────────────

export const GetStoryLatestResponseSchema = z
  .object({
    success: z.boolean().openapi({ example: true }),
    message: z.string().openapi({ example: "Latest story node retrieved" }),
    data: z
      .object({
        id: z.string(),
        content: z.string(),
        choices: z.array(StoryChoiceSchema),
        statChanges: z.record(z.string(), z.number()).optional(),
        updatedAttributes: z.record(z.string(), z.number()).optional(),
      })
      .nullable()
      .openapi("StoryNodeDataNullable"),
  })
  .openapi("GetStoryLatestResponse");

// ─── Get Story History — Response Body ──────────────────────────

export const GetStoryHistoryResponseSchema = z
  .object({
    success: z.boolean().openapi({ example: true }),
    message: z.string().openapi({ example: "Story history retrieved" }),
    data: z.array(
      z.object({
        id: z.string(),
        content: z.string(),
        choices: z.any().optional(),
        actionTaken: z.string().nullable().optional(),
        parentNodeId: z.string().nullable().optional(),
        statChanges: z.record(z.string(), z.number()).nullable().optional(),
        createdAt: z.string().optional(),
      })
    ).openapi("StoryHistoryData"),
  })
  .openapi("GetStoryHistoryResponse");

// ─── Health Check — Response ────────────────────────────────────

export const HealthCheckResponseSchema = z
  .object({
    success: z.boolean().openapi({ example: true }),
    message: z
      .string()
      .openapi({ example: "Thiên Đạo Core API is running!" }),
    version: z.string().openapi({ example: "1.0.0" }),
  })
  .openapi("HealthCheckResponse");

// ─── Error Response ─────────────────────────────────────────────

export const ErrorResponseSchema = z
  .object({
    success: z.boolean().openapi({ example: false }),
    message: z.string().openapi({ example: "Validation failed" }),
    error: z
      .string()
      .optional()
      .openapi({ example: "characterId is required" }),
  })
  .openapi("ErrorResponse");
