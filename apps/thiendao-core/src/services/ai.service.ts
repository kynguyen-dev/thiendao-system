import { GoogleGenAI } from "@google/genai";

// ─── Gemini Client ──────────────────────────────────────────────

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn(
    "⚠️  GEMINI_API_KEY not set — AI story generation will be unavailable"
  );
}

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// ─── Types ──────────────────────────────────────────────────────

export interface StoryGenerationResult {
  story_text: string;
  stat_changes: Record<string, number>;
  choices: { label: string; action: string }[];
}

// ─── System Instruction ─────────────────────────────────────────

const SYSTEM_INSTRUCTION = `You are a Dark Fantasy Cultivation Game Master for the game "Tu Tiên Giới: Huyền Huyễn Kỷ" (The Cultivation World: Dark Fantasy Era).

Your role:
- You narrate a thrilling, atmospheric cultivation story in Vietnamese.
- The world is full of mystical sects, ancient beasts, forbidden techniques, and heavenly tribulations.
- Each story segment should be 2-4 paragraphs, vivid and immersive.
- Present 2-3 meaningful choices that affect the character's journey.
- Based on the action taken, determine stat changes (positive or negative).

Character stats: strength, intelligence, charisma, luck (can be modified by -5 to +5 each turn).

You MUST respond with valid JSON in this exact structure:
{
  "story_text": "The narrative text in Vietnamese...",
  "stat_changes": { "strength": 2, "intelligence": -1, "charisma": 0, "luck": 1 },
  "choices": [
    { "label": "Choice description in Vietnamese", "action": "action_key" },
    { "label": "Another choice", "action": "another_action" }
  ]
}`;

// ─── Model Config ───────────────────────────────────────────────
// gemini-2.0-flash: 1500 RPD free tier (vs gemini-2.5-flash's 20 RPD)
const AI_MODEL = "gemini-2.0-flash";
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 10_000; // 10 seconds

// ─── Retry Helper ───────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractRetryDelay(error: unknown): number | null {
  try {
    const msg = error instanceof Error ? error.message : String(error);
    const match = msg.match(/retry\s*(?:in|delay[\":\s]*)\s*(\d+(?:\.\d+)?)\s*s/i);
    if (match?.[1]) return Math.ceil(parseFloat(match[1]) * 1000);
  } catch {}
  return null;
}

// ─── Generate Story ─────────────────────────────────────────────

export async function generateStoryNode(params: {
  characterName: string;
  characterBackground: string | null;
  cheatSystem: string | null;
  currentStats: Record<string, number>;
  actionTaken: string | null;
  previousContent: string | null;
}): Promise<StoryGenerationResult> {
  if (!ai) {
    // Fallback mock when no API key is configured
    return {
      story_text:
        "Trước mặt ngươi là một ngã ba đường. " +
        "Bên trái là con đường dẫn vào Huyền Thiên Phong, sương mù dày đặc bao phủ. " +
        "Bên phải là Vạn Thú Cốc, tiếng gầm thét của linh thú vọng lại từ xa. " +
        "Ngươi cảm nhận được linh khí dồi dào ở cả hai nơi...",
      stat_changes: { strength: 0, intelligence: 0, charisma: 0, luck: 0 },
      choices: [
        { label: "Tiến vào Huyền Thiên Phong", action: "enter_peak" },
        { label: "Khám phá Vạn Thú Cốc", action: "explore_valley" },
        { label: "Dừng lại tĩnh tu", action: "meditate" },
      ],
    };
  }

  const userPrompt = buildUserPrompt(params);

  // Retry loop with exponential backoff for 429 rate limits
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: AI_MODEL,
        contents: userPrompt,
        config: {
          responseMimeType: "application/json",
          systemInstruction: SYSTEM_INSTRUCTION,
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error("Gemini returned empty response");
      }

      const parsed: StoryGenerationResult = JSON.parse(text);

      // Validate the response structure
      if (!parsed.story_text || !Array.isArray(parsed.choices)) {
        throw new Error("Invalid AI response structure");
      }

      return parsed;
    } catch (error: unknown) {
      lastError = error;
      const errorMsg = error instanceof Error ? error.message : String(error);
      const isRateLimit = errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED");

      if (isRateLimit && attempt < MAX_RETRIES) {
        const retryDelay = extractRetryDelay(error) ?? BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `⚠️  Rate limited (attempt ${attempt + 1}/${MAX_RETRIES}). ` +
          `Retrying in ${Math.round(retryDelay / 1000)}s...`
        );
        await sleep(retryDelay);
        continue;
      }

      // Not a rate limit error, or we've exhausted retries — rethrow
      throw error;
    }
  }

  throw lastError;
}

// ─── Build Prompt ───────────────────────────────────────────────

function buildUserPrompt(params: {
  characterName: string;
  characterBackground: string | null;
  cheatSystem: string | null;
  currentStats: Record<string, number>;
  actionTaken: string | null;
  previousContent: string | null;
}): string {
  let prompt = `Nhân vật: ${params.characterName}\n`;

  if (params.characterBackground) {
    prompt += `Lai lịch: ${params.characterBackground}\n`;
  }

  if (params.cheatSystem) {
    prompt += `Kim thủ chỉ (Hệ thống gian lận): ${params.cheatSystem}\n`;
  }

  prompt += `Chỉ số hiện tại: ${JSON.stringify(params.currentStats)}\n`;

  if (params.previousContent) {
    prompt += `\nĐoạn truyện trước:\n${params.previousContent}\n`;
  }

  if (params.actionTaken) {
    prompt += `\nHành động người chơi chọn: "${params.actionTaken}"\n`;
    prompt += `\nHãy tiếp tục câu chuyện dựa trên hành động này.`;
  } else {
    prompt += `\nĐây là khởi đầu hành trình tu tiên. Hãy viết đoạn mở đầu.`;
  }

  return prompt;
}
