import { serve } from "@hono/node-server";
import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { cors } from "hono/cors";
import { eq, desc, asc, and } from "drizzle-orm";
import * as dotenv from "dotenv";

import { healthCheckRoute, storyNextRoute, getStoryLatestRoute, getStoryRoute } from "./routes/story.route.js";
import {
  createCharacterRoute,
  getCharactersRoute,
  deleteCharacterRoute,
} from "./routes/character.route.js";
import { registerRoute, loginRoute, googleAuthRoute, meRoute, updateProfileRoute } from "./routes/auth.route.js";
import { createNovelRoute, getMyNovelsRoute, createChapterRoute, aiAssistRoute } from "./routes/novel.route.js";
import { db, schema } from "./db/index.js";
import { generateStoryNode, generateChapterText } from "./services/ai.service.js";
import { hashPassword, comparePassword, generateJWT, verifyGoogleToken } from "./services/auth.service.js";
import { authMiddleware } from "./middleware/auth.middleware.js";

dotenv.config();

// ─── App (OpenAPIHono for automatic spec generation) ────────────

const app = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json({
        success: false,
        message: "Dữ liệu không hợp lệ (Ví dụ: Link ảnh bìa sai định dạng, v.v)",
        errors: result.error.issues,
      }, 400);
    }
  }
});

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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  🔐 AUTH ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function serializeUser(user: typeof schema.users.$inferSelect) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    authProvider: user.authProvider,
    tuVi: user.tuVi,
    linhThach: user.linhThach,
    createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : String(user.createdAt),
  };
}

// ─── POST /api/auth/register ────────────────────────────────────

app.openapi(registerRoute, async (c) => {
  const { username, email, password } = c.req.valid("json");

  try {
    // Check if email or username already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(schema.users.email, email),
    });
    if (existingUser) {
      return c.json({ success: false as const, message: "Email đã được sử dụng" }, 400);
    }

    const existingUsername = await db.query.users.findFirst({
      where: eq(schema.users.username, username),
    });
    if (existingUsername) {
      return c.json({ success: false as const, message: "Tên tài khoản đã tồn tại" }, 400);
    }

    const passwordHash = await hashPassword(password);

    const [newUser] = await db
      .insert(schema.users)
      .values({
        username,
        email,
        passwordHash,
        displayName: username,
        authProvider: "local",
      })
      .returning();

    if (!newUser) {
      return c.json({ success: false as const, message: "Lỗi tạo tài khoản" }, 400);
    }

    const token = generateJWT({ userId: newUser.id, email: newUser.email });

    return c.json({
      success: true as const,
      message: "Đăng ký thành công",
      data: { token, user: serializeUser(newUser) },
    }, 201);
  } catch (error) {
    return c.json({ success: false as const, message: "Lỗi server", error: String(error) }, 400);
  }
});

// ─── POST /api/auth/login ───────────────────────────────────────

app.openapi(loginRoute, async (c) => {
  const { email, password } = c.req.valid("json");

  try {
    const user = await db.query.users.findFirst({
      where: eq(schema.users.email, email),
    });

    if (!user) {
      return c.json({ success: false as const, message: "Email hoặc mật khẩu không đúng" }, 401);
    }

    if (user.authProvider !== "local" || !user.passwordHash) {
      return c.json({
        success: false as const,
        message: "Tài khoản này sử dụng đăng nhập Google. Vui lòng dùng nút 'Đăng nhập bằng Google'.",
      }, 401);
    }

    const isValid = await comparePassword(password, user.passwordHash);
    if (!isValid) {
      return c.json({ success: false as const, message: "Email hoặc mật khẩu không đúng" }, 401);
    }

    const token = generateJWT({ userId: user.id, email: user.email });

    return c.json({
      success: true as const,
      message: "Đăng nhập thành công",
      data: { token, user: serializeUser(user) },
    }, 200);
  } catch (error) {
    return c.json({ success: false as const, message: "Lỗi server", error: String(error) }, 401);
  }
});

// ─── POST /api/auth/google ──────────────────────────────────────

app.openapi(googleAuthRoute, async (c) => {
  const { idToken } = c.req.valid("json");

  try {
    const googleUser = await verifyGoogleToken(idToken);

    // Find existing user by googleId or email
    let user = await db.query.users.findFirst({
      where: eq(schema.users.googleId, googleUser.googleId),
    });

    if (!user) {
      // Check if email already exists with local auth
      user = await db.query.users.findFirst({
        where: eq(schema.users.email, googleUser.email),
      });

      if (user) {
        // Link Google account to existing local user
        const [updated] = await db
          .update(schema.users)
          .set({ googleId: googleUser.googleId, avatarUrl: googleUser.picture || user.avatarUrl })
          .where(eq(schema.users.id, user.id))
          .returning();
        user = updated || user;
      } else {
        // Create new user from Google info
        const [newUser] = await db
          .insert(schema.users)
          .values({
            username: googleUser.email.split("@")[0] + "_" + Date.now().toString(36),
            email: googleUser.email,
            displayName: googleUser.name,
            avatarUrl: googleUser.picture,
            authProvider: "google",
            googleId: googleUser.googleId,
          })
          .returning();
        user = newUser;
      }
    }

    if (!user) {
      return c.json({ success: false as const, message: "Lỗi xử lý đăng nhập Google" }, 400);
    }

    const token = generateJWT({ userId: user.id, email: user.email });

    return c.json({
      success: true as const,
      message: "Đăng nhập Google thành công",
      data: { token, user: serializeUser(user) },
    }, 200);
  } catch (error) {
    return c.json({ success: false as const, message: "Token Google không hợp lệ", error: String(error) }, 400);
  }
});

// ─── GET /api/auth/me ───────────────────────────────────────────

app.openapi(meRoute, async (c) => {
  // Apply auth manually for this route
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ success: false as const, message: "Chưa đăng nhập" }, 401);
  }

  try {
    const { verifyJWT } = await import("./services/auth.service.js");
    const payload = verifyJWT(authHeader.slice(7));

    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, payload.userId),
    });

    if (!user) {
      return c.json({ success: false as const, message: "Tài khoản không tồn tại" }, 401);
    }

    return c.json({
      success: true as const,
      data: serializeUser(user),
    }, 200);
  } catch {
    return c.json({ success: false as const, message: "Phiên đăng nhập hết hạn" }, 401);
  }
});

// ─── PUT /api/auth/profile ──────────────────────────────────────────

app.openapi(updateProfileRoute, async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ success: false as const, message: "Chưa đăng nhập" }, 401);
  }

  try {
    const { verifyJWT } = await import("./services/auth.service.js");
    const payload = verifyJWT(authHeader.slice(7));
    const body = c.req.valid("json");

    const [updatedUser] = await db
      .update(schema.users)
      .set({
        displayName: body.displayName ?? undefined,
        bio: body.bio ?? undefined,
        avatarUrl: body.avatarUrl ?? undefined,
      })
      .where(eq(schema.users.id, payload.userId))
      .returning();

    if (!updatedUser) {
      return c.json({ success: false as const, message: "Tài khoản không tồn tại" }, 401);
    }

    return c.json({
      success: true as const,
      data: serializeUser(updatedUser),
    }, 200);
  } catch (error) {
    return c.json({ success: false as const, message: "Lỗi cập nhật hồ sơ", error: String(error) }, 400);
  }
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
      worldSettings: body.worldSettings ?? null,
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

// ─── GET /api/characters/:id — Get character by id ──────────────

app.get("/api/characters/:id", async (c) => {
  const id = c.req.param("id");

  try {
    const character = await db.query.characters.findFirst({
      where: eq(schema.characters.id, id),
    });

    if (!character) {
      return c.json({ success: false, message: "Nhân vật không tồn tại" }, 404);
    }

    return c.json({
      success: true,
      message: "Lấy thông tin nhân vật thành công",
      data: {
        ...character,
        createdAt: character.createdAt instanceof Date ? character.createdAt.toISOString() : String(character.createdAt),
      },
    }, 200);
  } catch (error) {
    return c.json({ success: false, message: "Database Error", error: String(error) }, 500);
  }
});

// ─── GET /api/characters — Get all characters ───────────────────

app.openapi(getCharactersRoute, async (c) => {
  try {
    const allCharacters = await db.query.characters.findMany({
      orderBy: [desc(schema.characters.createdAt)],
      columns: {
        id: true,
        name: true,
        background: true,
        cheatSystem: true,
        attributes: true,
        worldSettings: true,
        createdAt: true,
      },
    });

    return c.json({
      success: true as const,
      message: "Danh sách nhân vật",
      data: allCharacters.map((char) => ({
        ...char,
        createdAt: char.createdAt instanceof Date ? char.createdAt.toISOString() : String(char.createdAt),
      })),
    }, 200);
  } catch (error) {
    return c.json(
      { success: false as const, message: "Database Error", error: String(error) },
      500
    );
  }
});

// ─── DELETE /api/characters/:id — Delete Character ───────────────

app.openapi(deleteCharacterRoute, async (c) => {
  const { id } = c.req.valid("param");

  try {
    const deletedId = await db.transaction(async (tx) => {
      // Cascade delete story nodes manually mapped to the character
      await tx.delete(schema.storyNodes).where(eq(schema.storyNodes.characterId, id));

      // Delete character
      const [deletedChar] = await tx
        .delete(schema.characters)
        .where(eq(schema.characters.id, id))
        .returning({ id: schema.characters.id });

      return deletedChar?.id;
    });

    if (!deletedId) {
      return c.json(
        {
          success: false as const,
          message: "Character not found or already deleted",
        },
        400
      );
    }

    return c.json(
      {
        success: true as const,
        message: "Character and story nodes erased",
      },
      200
    );
  } catch (error) {
    return c.json(
      { success: false as const, message: "Database Error", error: String(error) },
      400
    );
  }
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
  const currentStats = (character.attributes as Record<string, any>) ?? {};
  const currentRealm = typeof currentStats.currentRealm === "string" ? currentStats.currentRealm : "Luyện Khí Kỳ";

  let aiResult;
  try {
    aiResult = await generateStoryNode({
      characterName: character.name,
      characterBackground: character.background,
      cheatSystem: character.cheatSystem,
      currentStats: currentStats as Record<string, number>,
      actionTaken: actionTaken ?? null,
      previousContent,
      worldSettings: character.worldSettings,
      currentRealm,
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
      .set({
        attributes: updatedAttributes,
      })
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

// ─── GET /api/story/:characterId/latest — Get Latest Story Node ──

app.openapi(getStoryLatestRoute, async (c) => {
  const { characterId } = c.req.valid("param");

  try {
    const latestNode = await db.query.storyNodes.findFirst({
      where: eq(schema.storyNodes.characterId, characterId),
      orderBy: [desc(schema.storyNodes.createdAt)],
    });

    if (!latestNode) {
      return c.json({
        success: true as const,
        message: "No story nodes found in history",
        data: null,
      }, 200);
    }

    return c.json({
      success: true as const,
      message: "Latest story node retrieved",
      data: {
        id: latestNode.id,
        content: latestNode.content,
        choices: (latestNode.choices as any) || [],
      },
    }, 200);
  } catch (error) {
    return c.json({
      success: false as const,
      message: "Database Error",
      error: String(error),
    }, 400);
  }
});

// ─── GET /api/story/:characterId — Get Story History ────────────

app.openapi(getStoryRoute, async (c) => {
  const { characterId } = c.req.valid("param");

  try {
    const history = await db.query.storyNodes.findMany({
      where: eq(schema.storyNodes.characterId, characterId),
      orderBy: [asc(schema.storyNodes.createdAt)],
    });

    return c.json({
      success: true as const,
      message: "Story history retrieved",
      data: history.map((node) => ({
        id: node.id,
        content: node.content,
        choices: node.choices,
        actionTaken: node.actionTaken,
        parentNodeId: node.parentNodeId,
        statChanges: node.statChanges as any,
        createdAt: node.createdAt instanceof Date ? node.createdAt.toISOString() : String(node.createdAt),
      })),
    }, 200);
  } catch (error) {
    return c.json({
      success: false as const,
      message: "Database Error",
      error: String(error),
    }, 400);
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  📚 TÀNG KINH CÁC (WEB NOVEL: STORIES & CHAPTERS)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ─── GET /api/novels/browse — Tàng Kinh Các (Public Listing) ────

app.get("/api/novels/browse", async (c) => {
  try {
    const genre = c.req.query("genre");
    const search = c.req.query("q");

    let allStories = await db.query.stories.findMany({
      where: eq(schema.stories.status, "published"),
      orderBy: [desc(schema.stories.viewCount)],
      with: {
        author: {
          columns: { id: true, username: true, displayName: true, avatarUrl: true, tuVi: true }
        },
        chapters: {
          columns: { id: true }
        },
      }
    });

    // Filter by genre
    if (genre) {
      allStories = allStories.filter(s => s.genre?.toLowerCase() === genre.toLowerCase());
    }
    // Filter by search
    if (search) {
      const q = search.toLowerCase();
      allStories = allStories.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.synopsis?.toLowerCase().includes(q) ||
        s.author?.username.toLowerCase().includes(q)
      );
    }

    const result = allStories.map(s => ({
      id: s.id,
      title: s.title,
      synopsis: s.synopsis,
      coverImageUrl: s.coverImageUrl,
      genre: s.genre,
      tags: s.tags,
      status: s.status,
      viewCount: s.viewCount,
      chapterCount: s.chapters?.length || 0,
      author: s.author,
      createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt),
      updatedAt: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : String(s.updatedAt),
    }));

    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return c.json({ success: false, message: "Lỗi tải danh sách truyện", error: String(error) }, 400);
  }
});

// ─── GET /api/novels/:novelId — Chi Tiết Truyện ────────────────

app.get("/api/novels/:novelId/detail", async (c) => {
  const novelId = c.req.param("novelId");
  try {
    const story = await db.query.stories.findFirst({
      where: eq(schema.stories.id, novelId),
      with: {
        author: {
          columns: { id: true, username: true, displayName: true, avatarUrl: true, tuVi: true }
        },
        chapters: {
          columns: { id: true, chapterNumber: true, title: true, wordCount: true, isPublished: true, createdAt: true },
          orderBy: [schema.chapters.chapterNumber],
        },
      }
    });

    if (!story) {
      return c.json({ success: false, message: "Không tìm thấy truyện" }, 404);
    }

    // Increment view count
    await db.update(schema.stories).set({ viewCount: story.viewCount + 1 }).where(eq(schema.stories.id, novelId));

    return c.json({ success: true, data: {
      ...story,
      createdAt: story.createdAt instanceof Date ? story.createdAt.toISOString() : String(story.createdAt),
      updatedAt: story.updatedAt instanceof Date ? story.updatedAt.toISOString() : String(story.updatedAt),
    }}, 200);
  } catch (error) {
    return c.json({ success: false, message: "Lỗi tải truyện" }, 400);
  }
});

app.get("/api/novels/:novelId/comments", async (c) => {
  const novelId = c.req.param("novelId");
  try {
    const novelComments = await db.query.comments.findMany({
      where: eq(schema.comments.storyId, novelId),
      orderBy: [desc(schema.comments.createdAt)],
      with: {
        user: {
          columns: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            tuVi: true,
          }
        }
      }
    });
    return c.json({ success: true, data: novelComments }, 200);
  } catch (error) {
    return c.json({ success: false, message: "Lỗi tải bình luận" }, 400);
  }
});

// ─── POST /api/novels/:novelId/comments — Thêm Bình Luận ────────

app.post("/api/novels/:novelId/comments", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ success: false, message: "Chưa đăng nhập" }, 401);
  }

  try {
    const { verifyJWT } = await import("./services/auth.service.js");
    const payload = verifyJWT(authHeader.slice(7));
    const novelId = c.req.param("novelId");
    const body = await c.req.json();

    const [newComment] = await db.insert(schema.comments).values({
      userId: payload.userId,
      storyId: novelId,
      content: body.content,
    }).returning();

    // +1 Tu Vi to the user who comments
    const user = await db.query.users.findFirst({where: eq(schema.users.id, payload.userId)});
    if(user) {
      await db.update(schema.users).set({ tuVi: user.tuVi + 1 }).where(eq(schema.users.id, payload.userId));
    }

    return c.json({ success: true, data: newComment }, 201);
  } catch (error) {
    return c.json({ success: false, message: "Lỗi thêm bình luận" }, 400);
  }
});

// ─── POST /api/novels — Tạo Truyện ──────────────────────────────

app.openapi(createNovelRoute, async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ success: false as const, message: "Chưa đăng nhập" }, 401);
  }

  try {
    const { verifyJWT } = await import("./services/auth.service.js");
    const payload = verifyJWT(authHeader.slice(7));
    const body = c.req.valid("json");

    const [newStory] = await db.insert(schema.stories).values({
      title: body.title,
      synopsis: body.synopsis ?? null,
      coverImageUrl: body.coverImageUrl ?? null,
      genre: body.genre ?? null,
      tags: body.tags ?? [],
      authorId: payload.userId,
      status: "draft",
    }).returning();

    return c.json({
      success: true as const,
      message: "Tạo truyện thành công",
      data: {
        id: newStory.id,
        authorId: newStory.authorId,
        title: newStory.title,
        synopsis: newStory.synopsis ?? null,
        coverImageUrl: newStory.coverImageUrl ?? null,
        genre: newStory.genre ?? null,
        tags: newStory.tags as string[],
        status: newStory.status,
        viewCount: newStory.viewCount,
        createdAt: newStory.createdAt instanceof Date ? newStory.createdAt.toISOString() : String(newStory.createdAt),
        updatedAt: newStory.updatedAt instanceof Date ? newStory.updatedAt.toISOString() : String(newStory.updatedAt),
      }
    }, 201);
  } catch (error) {
    return c.json({ success: false as const, message: "Lỗi tạo truyện", error: String(error) }, 400);
  }
});

// ─── GET /api/novels/my — Tác Phẩm Của Tôi ────────────────────────

app.openapi(getMyNovelsRoute, async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ success: false as const, message: "Chưa đăng nhập" }, 401);
  }

  try {
    const { verifyJWT } = await import("./services/auth.service.js");
    const payload = verifyJWT(authHeader.slice(7));

    const myStories = await db.query.stories.findMany({
      where: eq(schema.stories.authorId, payload.userId),
      orderBy: [desc(schema.stories.updatedAt)],
    });

    return c.json({
      success: true as const,
      message: "Thành công",
      data: myStories.map(s => ({
        id: s.id,
        authorId: s.authorId,
        title: s.title,
        coverImageUrl: s.coverImageUrl,
        genre: s.genre,
        status: s.status,
        viewCount: s.viewCount,
      }))
    }, 200);
  } catch (error) {
    return c.json({ success: false as const, message: "Lỗi hệ thống", error: String(error) }, 400);
  }
});

// ─── POST /api/novels/:novelId/chapters — Thêm Chương Mới ─────────

app.openapi(createChapterRoute, async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ success: false as const, message: "Chưa đăng nhập" }, 401);
  }

  try {
    const { verifyJWT } = await import("./services/auth.service.js");
    const payload = verifyJWT(authHeader.slice(7));
    const { novelId } = c.req.valid("param");
    const body = c.req.valid("json");

    // 1. Kiểm tra truyện có phải của author không
    const story = await db.query.stories.findFirst({
      where: eq(schema.stories.id, novelId),
    });

    if (!story || story.authorId !== payload.userId) {
      return c.json({ success: false as const, message: "Không tìm thấy truyện hoặc bạn không có quyền thêm chương" }, 401);
    }

    // 2. Tìm số chương hiện tại dựa trên tổng số chapter hiện có
    const chapterCountRes = await db.query.chapters.findMany({
      where: eq(schema.chapters.storyId, novelId),
    });
    const nextChapterNum = chapterCountRes.length + 1;
    const isPublishedValue = typeof body.isPublished === "number" ? body.isPublished : 0;

    // 3. Thêm chương
    const [newChapter] = await db.insert(schema.chapters).values({
      storyId: novelId,
      chapterNumber: nextChapterNum,
      title: body.title ?? null,
      content: body.content,
      isPublished: isPublishedValue,
      wordCount: body.content.split(/\s+/).length,
    }).returning();

    // 4. Update thời gian truyện
    await db.update(schema.stories)
      .set({ updatedAt: new Date() })
      .where(eq(schema.stories.id, novelId));

    return c.json({
      success: true as const,
      message: "Thêm chương thành công",
      data: {
         id: newChapter.id,
         storyId: newChapter.storyId,
         chapterNumber: newChapter.chapterNumber,
         title: newChapter.title ?? null,
         content: newChapter.content,
         wordCount: newChapter.wordCount,
         isPublished: newChapter.isPublished,
         createdAt: newChapter.createdAt instanceof Date ? newChapter.createdAt.toISOString() : String(newChapter.createdAt),
      }
    }, 201);
  } catch (error) {
    return c.json({ success: false as const, message: "Lỗi thêm chương", error: String(error) }, 400);
  }
});

// ─── GET /api/novels/:novelId/chapters — Danh Sách Chương ─────────

app.get("/api/novels/:novelId/chapters", async (c) => {
  const novelId = c.req.param("novelId");
  try {
    const chaptersList = await db.query.chapters.findMany({
      where: eq(schema.chapters.storyId, novelId),
      columns: { id: true, chapterNumber: true, title: true, wordCount: true, isPublished: true, createdAt: true },
      orderBy: [schema.chapters.chapterNumber],
    });
    return c.json({ success: true, data: chaptersList }, 200);
  } catch (error) {
    return c.json({ success: false, message: "Lỗi tải danh sách chương" }, 400);
  }
});

// ─── GET /api/novels/:novelId/chapters/:chapterNum — Đọc Chương ───

app.get("/api/novels/:novelId/chapters/:chapterNum", async (c) => {
  const novelId = c.req.param("novelId");
  const chapterNum = parseInt(c.req.param("chapterNum"));
  try {
    const chapter = await db.query.chapters.findFirst({
      where: and(
        eq(schema.chapters.storyId, novelId),
        eq(schema.chapters.chapterNumber, chapterNum)
      ),
    });

    if (!chapter) {
      return c.json({ success: false, message: "Không tìm thấy chương" }, 404);
    }

    // Get story info for context
    const story = await db.query.stories.findFirst({
      where: eq(schema.stories.id, novelId),
      columns: { id: true, title: true, authorId: true },
      with: {
        author: { columns: { id: true, username: true, displayName: true } },
      }
    });

    // Total chapters count
    const allChapters = await db.query.chapters.findMany({
      where: eq(schema.chapters.storyId, novelId),
      columns: { chapterNumber: true },
    });

    return c.json({
      success: true,
      data: {
        ...chapter,
        createdAt: chapter.createdAt instanceof Date ? chapter.createdAt.toISOString() : String(chapter.createdAt),
        story: story ? { id: story.id, title: story.title, author: story.author } : null,
        totalChapters: allChapters.length,
      }
    }, 200);
  } catch (error) {
    console.error("❌ Lỗi tải chương:", error);
    return c.json({ success: false, message: "Lỗi tải chương", error: String(error) }, 400);
  }
});

app.openapi(aiAssistRoute, async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ success: false as const, message: "Chưa đăng nhập" }, 401);
  }

  try {
    const { verifyJWT } = await import("./services/auth.service.js");
    const payload = verifyJWT(authHeader.slice(7));
    const { novelId } = c.req.valid("param");
    const body = c.req.valid("json");

    // 1. Kiểm tra truyện
    const story = await db.query.stories.findFirst({
      where: eq(schema.stories.id, novelId),
    });

    if (!story || story.authorId !== payload.userId) {
      return c.json({ success: false as const, message: "Không tìm thấy truyện hoặc bạn không có quyền" }, 401);
    }

    // 2. Call AI
    const generatedText = await generateChapterText({
      title: story.title,
      synopsis: story.synopsis,
      genre: story.genre,
      tags: story.tags as string[],
      prompt: body.prompt,
    });

    return c.json({
      success: true as const,
      message: "AI hỗ trợ thành công",
      data: {
        generatedText,
      }
    }, 200);
  } catch (error) {
    return c.json({ success: false as const, message: "Lỗi AI Trợ viết", error: String(error) }, 400);
  }
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
          default: "3000",
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
    {
      name: "📚 Tàng Kinh Các (Web Novel)",
      description: "Novel engine — API quản lý truyện và chương",
    },
    {
      name: "📖 Chương Truyện (Chapters)",
      description: "Quản lý nội dung chương truyện theo từng tác phẩm",
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
