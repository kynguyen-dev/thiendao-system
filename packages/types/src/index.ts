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
}

export interface CreateCharacterInput {
  name: string;
  background?: string;
  cheatSystem?: string;
  attributes?: CharacterAttributes;
}

// ─── Story Types ────────────────────────────────────────────────

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
