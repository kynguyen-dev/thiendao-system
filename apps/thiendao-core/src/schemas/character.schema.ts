import { z } from "@hono/zod-openapi";

// ─── Character Attributes Schema ────────────────────────────────

export const CharacterAttributesSchema = z
  .object({
    strength: z.number().optional().openapi({ example: 10 }),
    intelligence: z.number().optional().openapi({ example: 10 }),
    charisma: z.number().optional().openapi({ example: 10 }),
    luck: z.number().optional().openapi({ example: 10 }),
  })
  .passthrough()
  .openapi("CharacterAttributes");

// ─── Create Character — Request Body ────────────────────────────

export const CreateCharacterRequestSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .max(255)
      .openapi({
        example: "Lâm Phong",
        description: "Tên nhân vật tu tiên",
      }),
    background: z
      .string()
      .optional()
      .openapi({
        example:
          "Xuất thân từ một gia tộc tu tiên sa sút, bị coi là phế vật từ nhỏ.",
        description: "Lai lịch nhân vật",
      }),
    cheatSystem: z
      .string()
      .optional()
      .openapi({
        example: "Hệ Thống Luyện Đan Tối Thượng",
        description: "Kim thủ chỉ / Hệ thống gian lận của nhân vật",
      }),
    attributes: CharacterAttributesSchema.optional().openapi({
      description: "Chỉ số nhân vật ban đầu (mặc định: 10 cho mỗi chỉ số)",
    }),
  })
  .openapi("CreateCharacterRequest");

// ─── Create Character — Response Body ───────────────────────────

export const CreateCharacterResponseSchema = z
  .object({
    success: z.boolean().openapi({ example: true }),
    message: z.string().openapi({ example: "Character created successfully" }),
    data: z
      .object({
        id: z.string().openapi({ example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" }),
        name: z.string().openapi({ example: "Lâm Phong" }),
        attributes: CharacterAttributesSchema,
      })
      .openapi("CreatedCharacterData"),
  })
  .openapi("CreateCharacterResponse");
