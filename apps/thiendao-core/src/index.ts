import { serve } from "@hono/node-server";
import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { cors } from "hono/cors";
import { eq } from "drizzle-orm";
import * as dotenv from "dotenv";

import { healthCheckRoute, storyNextRoute } from "./routes/story.route.js";
import { createCharacterRoute } from "./routes/character.route.js";
import { db, schema } from "./db/index.js";
import { generateStoryNode } from "./services/ai.service.js";

dotenv.config();

// ─── App (OpenAPIHono for automatic spec generation) ────────────

const app = new OpenAPIHono();

// ─── Middleware ──────────────────────────────────────────────────

app.use(
  "/*",
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  })
);

// ─── Routes ─────────────────────────────────────────────────────

// GET / — Health Check
app.openapi(healthCheckRoute, (c) => {
  return c.json({
    success: true as const,
    message: "Thiên Đạo Core API is running!",
    version: "1.0.0",
  });
});

// ─── POST /api/characters — Create Character ────────────────────

app.openapi(createCharacterRoute, async (c) => {
  const body = c.req.valid("json");

  const defaultAttributes = {
    strength: 10,
    intelligence: 10,
    charisma: 10,
    luck: 10,
  };

  const attributes = body.attributes
    ? { ...defaultAttributes, ...body.attributes }
    : defaultAttributes;

  const [newCharacter] = await db
    .insert(schema.characters)
    .values({
      name: body.name,
      background: body.background ?? null,
      cheatSystem: body.cheatSystem ?? null,
      attributes,
    })
    .returning({
      id: schema.characters.id,
      name: schema.characters.name,
      attributes: schema.characters.attributes,
    });

  if (!newCharacter) {
    return c.json(
      {
        success: false as const,
        message: "Failed to create character",
        error: "Database insert returned no result",
      },
      400
    );
  }

  return c.json(
    {
      success: true as const,
      message: "Character created successfully",
      data: {
        id: newCharacter.id,
        name: newCharacter.name,
        attributes: newCharacter.attributes as Record<string, number>,
      },
    },
    201
  );
});

// ─── POST /api/story/next — Advance Story (AI-Powered) ──────────
//
// Transaction Logic:
// 1. Fetch the character from DB (validate existence + get current stats)
// 2. If previousNodeId is provided, fetch that node's content for context
// 3. Call Gemini AI to generate the next story segment
// 4. Open a DB TRANSACTION that atomically:
//    a) Inserts the new story node (content, choices, stat_changes)
//    b) Updates the character's attributes with the AI's stat_changes
// 5. Return the complete result to the client
//
// The transaction ensures data consistency: if either the node insert
// or the stat update fails, BOTH are rolled back.
// ─────────────────────────────────────────────────────────────────

app.openapi(storyNextRoute, async (c) => {
  const body = c.req.valid("json");
  const { characterId, previousNodeId, actionTaken } = body;

  // 1. Fetch character
  const character = await db.query.characters.findFirst({
    where: eq(schema.characters.id, characterId),
  });

  if (!character) {
    return c.json(
      {
        success: false as const,
        message: "Character not found",
        error: `No character with id: ${characterId}`,
      },
      400
    );
  }

  // 2. Fetch previous node content (for AI context)
  let previousContent: string | null = null;
  if (previousNodeId) {
    const previousNode = await db.query.storyNodes.findFirst({
      where: eq(schema.storyNodes.id, previousNodeId),
    });
    previousContent = previousNode?.content ?? null;
  }

  // 3. Call Gemini AI
  const currentStats = (character.attributes as Record<string, number>) ?? {};

  let aiResult;
  try {
    aiResult = await generateStoryNode({
      characterName: character.name,
      characterBackground: character.background,
      cheatSystem: character.cheatSystem,
      currentStats,
      actionTaken: actionTaken ?? null,
      previousContent,
    });
  } catch (error) {
    console.error("AI generation failed:", error);
    const errorMsg = error instanceof Error ? error.message : "Unknown AI error";
    const isRateLimit = errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED");

    return c.json(
      {
        success: false as const,
        message: isRateLimit
          ? "Thiên Đạo tạm thời quá tải. Xin đạo hữu chờ vài phút rồi thử lại."
          : "Failed to generate story",
        error: errorMsg,
      },
      isRateLimit ? 429 : 400
    );
  }

  // 4. Database Transaction — atomic insert + update
  const updatedAttributes = { ...currentStats };
  for (const [stat, change] of Object.entries(aiResult.stat_changes)) {
    updatedAttributes[stat] = (updatedAttributes[stat] ?? 0) + change;
  }

  const [newNode] = await db.transaction(async (tx) => {
    // 4a. Insert new story node
    const insertedNodes = await tx
      .insert(schema.storyNodes)
      .values({
        characterId,
        content: aiResult.story_text,
        choices: aiResult.choices,
        actionTaken: actionTaken ?? null,
        parentNodeId: previousNodeId ?? null,
        statChanges: aiResult.stat_changes,
      })
      .returning({ id: schema.storyNodes.id });

    // 4b. Update character's attributes
    await tx
      .update(schema.characters)
      .set({ attributes: updatedAttributes })
      .where(eq(schema.characters.id, characterId));

    return insertedNodes;
  });

  if (!newNode) {
    return c.json(
      {
        success: false as const,
        message: "Failed to save story node",
        error: "Transaction returned no result",
      },
      400
    );
  }

  // 5. Return result
  return c.json({
    success: true as const,
    message: "Story node generated successfully",
    data: {
      id: newNode.id,
      content: aiResult.story_text,
      choices: aiResult.choices,
      statChanges: aiResult.stat_changes,
      updatedAttributes,
    },
  });
});

// ─── OpenAPI Spec (JSON) ────────────────────────────────────────

app.doc("/doc", {
  openapi: "3.1.0",
  info: {
    title: "⚔️ Thiên Đạo Core API",
    version: "1.0.0",
    description:
      "**Tu Tiên Giới: Huyền Huyễn Kỷ** — Backend API\n\n" +
      "Hệ thống API phục vụ trình duyệt Interactive Fiction, " +
      "nơi AI sinh ra câu chuyện tu tiên dựa trên lựa chọn của người chơi.\n\n" +
      "---\n\n" +
      "### 🌟 Tính năng chính\n" +
      "- **Story Engine** — Sinh node truyện mới bằng AI (Gemini 2.5 Flash)\n" +
      "- **Character System** — Quản lý nhân vật tu tiên\n" +
      "- **World State** — Theo dõi trạng thái thế giới\n",
    contact: {
      name: "Thiên Đạo Team",
      url: "https://github.com/thiendao",
    },
  },
  servers: [
    {
      url: "http://localhost:{port}",
      description: "🔧 Local Development",
      variables: {
        port: {
          default: "3001",
          enum: ["3000", "3001"],
          description: "API port (3001 local, 3000 Docker)",
        },
      },
    },
  ],
  tags: [
    {
      name: "⚙️ System",
      description: "API health & system endpoints",
    },
    {
      name: "🧙 Characters",
      description: "Character CRUD — Tạo và quản lý nhân vật tu tiên",
    },
    {
      name: "📖 Story",
      description:
        "Story engine — AI sinh câu chuyện tu tiên dựa trên hành động người chơi",
    },
  ],
});

// ─── Scalar API Reference UI ────────────────────────────────────

app.get(
  "/reference",
  Scalar({
    url: "/doc",
    pageTitle: "⚔️ Thiên Đạo API Reference",
    theme: "moon",
    darkMode: true,
    forceDarkModeState: "dark",
    defaultOpenAllTags: true,
    hideDarkModeToggle: true,
    customCss: `
      /* ─── Dark Fantasy Custom Theme ─────────────────────────── */
      .scalar-app {
        --scalar-background-1: #0a0e17 !important;
        --scalar-background-2: #111827 !important;
        --scalar-background-3: #1a1f35 !important;
        --scalar-color-1: #e8e6e3 !important;
        --scalar-color-2: #b8b5b0 !important;
        --scalar-color-3: #8b8680 !important;
        --scalar-color-accent: #c4a962 !important;
        --scalar-color-green: #4ade80 !important;
        --scalar-color-blue: #60a5fa !important;
        --scalar-color-orange: #fb923c !important;
        --scalar-color-red: #f87171 !important;
        --scalar-border-color: #1e293b !important;
        --scalar-scrollbar-color: #334155 !important;
      }
    `,
  })
);

// ─── Server ─────────────────────────────────────────────────────

const port = Number(process.env.PORT) || 3001;

console.log(`🚀 Thiên Đạo Core API running on http://localhost:${port}`);
console.log(`📖 API Reference:  http://localhost:${port}/reference`);
console.log(`📄 OpenAPI Spec:   http://localhost:${port}/doc`);

serve({
  fetch: app.fetch,
  port,
});
