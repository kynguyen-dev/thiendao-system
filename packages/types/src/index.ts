// ─── Auth Types ─────────────────────────────────────────────────

export type AuthProvider = "local" | "google";

export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  authProvider: AuthProvider;
  createdAt: string;
}

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface GoogleAuthInput {
  idToken: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    token: string;
    user: User;
  };
}

// ─── Character Types ────────────────────────────────────────────

export interface CharacterAttributes {
  strength?: number;
  intelligence?: number;
  charisma?: number;
  luck?: number;
  [key: string]: number | undefined;
}

export interface Character {
  id: string;
  name: string;
  background: string | null;
  cheatSystem: string | null;
  attributes: CharacterAttributes;
  worldSettings?: { plane: string; cultivationPath: string; realmSystem: string; };
}

export interface CreateCharacterInput {
  name: string;
  background?: string;
  cheatSystem?: string;
  attributes?: CharacterAttributes;
  worldSettings?: { plane: string; cultivationPath: string; realmSystem: string; };
}

// ─── Story Types ────────────────────────────────────────────────

export type StoryStatus = "draft" | "published" | "completed";

export interface Story {
  id: string;
  authorId: string;
  title: string;
  synopsis: string | null;
  coverImageUrl: string | null;
  genre: string | null;
  tags: string[];
  status: StoryStatus;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  author?: User;
}

export interface CreateStoryInput {
  title: string;
  synopsis?: string;
  coverImageUrl?: string;
  genre?: string;
  tags?: string[];
}

export interface Chapter {
  id: string;
  storyId: string;
  chapterNumber: number;
  title: string | null;
  content: string;
  wordCount: number;
  isPublished: number;
  createdAt: string;
}

export interface CreateChapterInput {
  title?: string;
  content: string;
}

// ─── Rating Types ───────────────────────────────────────────────

export interface Rating {
  id: string;
  userId: string;
  storyId: string;
  score: number; // 1-5
  review: string | null;
  createdAt: string;
  user?: User;
}

export interface CreateRatingInput {
  score: number;
  review?: string;
}

// ─── Story Node Types (AI Generation) ───────────────────────────

export interface StoryChoice {
  label: string;
  action: string;
}

export interface StoryNode {
  id: string;
  characterId: string;
  content: string;
  choices: StoryChoice[];
  actionTaken: string | null;
  parentNodeId: string | null;
}

export interface StoryNextRequest {
  characterId: string;
  previousNodeId?: string;
  actionTaken?: string;
}

export interface StoryNextResponse {
  success: boolean;
  message: string;
  data: {
    id: string;
    content: string;
    choices: StoryChoice[];
  };
}

// ─── API Response Types ─────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T = unknown> {
  success: boolean;
  data: T[];
  pagination: {
    totalItems: number;
    totalPages: number;
    currentPage: number;
  };
}
