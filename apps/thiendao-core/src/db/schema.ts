import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";

// ─── Characters ─────────────────────────────────────────────────

export const characters = pgTable("characters", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  background: text("background"),
  cheatSystem: text("cheat_system"),
  attributes: jsonb("attributes")
    .notNull()
    .default({ strength: 10, intelligence: 10, charisma: 10, luck: 10 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Story Nodes ────────────────────────────────────────────────

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
