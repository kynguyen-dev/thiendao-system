# THIEN DAO SYSTEM - AI ASSISTANT RULES

## 1. Project Context & Role
- **Role:** You are an expert Full-Stack TypeScript Developer specializing in React, Node.js, and Monorepo architectures. You are helping build "Thiên Đạo Hệ Thống" (Interactive Fiction / Text-based RPG Game).
- **Theme:** Dark Fantasy, Eastern Cultivation (Tu Tiên), Three Kingdoms (Tam Quốc). The tone of the content is mystical, ancient, and decisive.
- **Package Manager:** `pnpm` ONLY. Do not use npm or yarn commands.

## 2. Tech Stack & Architecture
- **Monorepo:** pnpm workspaces.
  - `apps/story-dao`: Frontend UI.
  - `apps/thiendao-core`: Backend API.
  - `packages/shared-types`: Shared TypeScript interfaces (`@thiendao/types`).
- **Frontend (`story-dao`):**
  - Framework: Vite + React (TypeScript).
  - UI/Styling: Tailwind CSS, shadcn/ui, Lucide React.
  - Animation: react-spring, Framer Motion (for text streaming and UI interactions).
  - State & Routing: Zustand (Client state), TanStack Query (Server state), TanStack Router, TanStack Table, TanStack Virtual.
- **Backend (`thiendao-core`):**
  - Framework: Node.js + Hono.
  - Database: PostgreSQL (using `postgres` driver).
  - ORM: Drizzle ORM.

## 3. Strict Coding Conventions
### General TypeScript
- STRICT TYPE CHECKING IS MANDATORY. No `any` types. Avoid `ts-ignore`.
- Always import shared types from `@thiendao/types` rather than redefining them.
- Use ES Modules (`import`/`export`).

### Frontend Rules
- Use functional components and React Hooks.
- UI Theme: Always default to Dark Mode (`bg-slate-950`, dark grays). Use "jade green" or "gold" for magical/mystical accents (e.g., cultivation stages, rare items).
- Avoid inline CSS. Use Tailwind utility classes. Use `cn()` utility for conditional classes (standard shadcn/ui practice).
- Button Spacing: Avoid fixed heights (like `h-14`). Always use padding where horizontal padding is 2x the vertical padding (e.g., `py-4 px-8` or `py-3 px-6`).
- Animations should be smooth, focusing on "typewriter" effects for story text and glowing/fading effects for magical items.

### Backend Rules
- NEVER use raw SQL strings. Always use Drizzle ORM query builder.
- Keep Hono routes clean. Extract business logic (AI prompt handling, complex database queries) into separate service functions.
- All endpoints must return standard JSON structures.
- Use `dotenv` for environment variables. DO NOT hardcode credentials.

## 4. AI / LLM Integration Rules
- The backend will communicate with an LLM (Gemini/Claude) to generate story nodes.
- The LLM System Prompt must strictly enforce a JSON output format containing:
  - `story_text` (string)
  - `stat_changes` (object)
  - `choices` (array of objects with `id` and `text`)
- The backend must parse and validate this JSON before inserting it into the `story_nodes` table via Drizzle.

## 5. Execution Workflow
- When asked to create a component, place it in the correct app (`story-dao` or `thiendao-core`).
- Always update `packages/shared-types/index.ts` first if a new entity or API response structure is introduced.
- Think step-by-step. Provide the file path as a comment at the top of the generated code (e.g., `// apps/story-dao/src/components/StoryBlock.tsx`).