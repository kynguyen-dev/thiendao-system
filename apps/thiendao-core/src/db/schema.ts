import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  integer,
  smallint,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Enums ──────────────────────────────────────────────────────

export const authProviderEnum = pgEnum("auth_provider", ["local", "google"]);
export const storyStatusEnum = pgEnum("story_status", ["draft", "published", "completed"]);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  🔐 USERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash"), // null for Google auth users
  displayName: varchar("display_name", { length: 100 }),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  authProvider: authProviderEnum("auth_provider").notNull().default("local"),
  googleId: varchar("google_id", { length: 255 }).unique(),
  tuVi: integer("tu_vi").notNull().default(0), // Cultivation level points (EXP)
  linhThach: integer("linh_thach").notNull().default(0), // Currency
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  🧙 CHARACTERS (for AI story generation)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const characters = pgTable("characters", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  background: text("background"),
  cheatSystem: text("cheat_system"),
  attributes: jsonb("attributes")
    .notNull()
    .default({ strength: 10, intelligence: 10, charisma: 10, luck: 10 }),
  worldSettings: jsonb("world_settings").$type<{ plane: string; cultivationPath: string; realmSystem: string; }>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  📚 STORIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const stories = pgTable("stories", {
  id: uuid("id").primaryKey().defaultRandom(),
  authorId: uuid("author_id").references(() => users.id).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  synopsis: text("synopsis"),
  coverImageUrl: text("cover_image_url"),
  genre: varchar("genre", { length: 100 }),
  tags: jsonb("tags").$type<string[]>().default([]),
  status: storyStatusEnum("status").notNull().default("draft"),
  viewCount: integer("view_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  📖 CHAPTERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const chapters = pgTable("chapters", {
  id: uuid("id").primaryKey().defaultRandom(),
  storyId: uuid("story_id").references(() => stories.id, { onDelete: "cascade" }).notNull(),
  chapterNumber: integer("chapter_number").notNull(),
  title: varchar("title", { length: 500 }),
  content: text("content").notNull(),
  wordCount: integer("word_count").notNull().default(0),
  isPublished: integer("is_published").notNull().default(0), // 0 = draft, 1 = published
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  ⭐ RATINGS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const ratings = pgTable("ratings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  storyId: uuid("story_id").references(() => stories.id, { onDelete: "cascade" }).notNull(),
  score: smallint("score").notNull(), // 1-5
  review: text("review"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("ratings_user_story_idx").on(table.userId, table.storyId),
]);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  ❤️ FAVORITES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const favorites = pgTable("favorites", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  storyId: uuid("story_id").references(() => stories.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("favorites_user_story_idx").on(table.userId, table.storyId),
]);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  💬 COMMENTS (Luận Đạo)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  storyId: uuid("story_id").references(() => stories.id, { onDelete: "cascade" }).notNull(),
  chapterId: uuid("chapter_id").references(() => chapters.id, { onDelete: "cascade" }), // Optional: comment on specific chapter
  content: text("content").notNull(),
  likes: integer("likes").notNull().default(0),
  isDonation: integer("is_donation").notNull().default(0), // Amount of Linh Thach donated
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  📝 STORY NODES (AI generation history)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const storyNodes = pgTable("story_nodes", {
  id: uuid("id").primaryKey().defaultRandom(),
  characterId: uuid("character_id")
    .references(() => characters.id)
    .notNull(),
  content: text("content").notNull(),
  choices: jsonb("choices").notNull().default([]),
  actionTaken: text("action_taken"),
  parentNodeId: uuid("parent_node_id").references((): any => storyNodes.id),
  statChanges: jsonb("stat_changes").default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  🔗 RELATIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const usersRelations = relations(users, ({ many }) => ({
  stories: many(stories),
  ratings: many(ratings),
  favorites: many(favorites),
  comments: many(comments),
}));

export const storiesRelations = relations(stories, ({ one, many }) => ({
  author: one(users, { fields: [stories.authorId], references: [users.id] }),
  chapters: many(chapters),
  ratings: many(ratings),
  favorites: many(favorites),
  comments: many(comments),
}));

export const chaptersRelations = relations(chapters, ({ one, many }) => ({
  story: one(stories, { fields: [chapters.storyId], references: [stories.id] }),
  comments: many(comments),
}));

export const ratingsRelations = relations(ratings, ({ one }) => ({
  user: one(users, { fields: [ratings.userId], references: [users.id] }),
  story: one(stories, { fields: [ratings.storyId], references: [stories.id] }),
}));

export const favoritesRelations = relations(favorites, ({ one }) => ({
  user: one(users, { fields: [favorites.userId], references: [users.id] }),
  story: one(stories, { fields: [favorites.storyId], references: [stories.id] }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  user: one(users, { fields: [comments.userId], references: [users.id] }),
  story: one(stories, { fields: [comments.storyId], references: [stories.id] }),
  chapter: one(chapters, { fields: [comments.chapterId], references: [chapters.id] }),
}));
