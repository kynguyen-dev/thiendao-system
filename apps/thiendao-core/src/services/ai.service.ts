import Groq from "groq-sdk";
import { GoogleGenAI } from "@google/genai";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  🤖 AI Provider: Groq (primary, free) + Gemini (fallback)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ─── Groq Client (Primary — Free Tier) ──────────────────────────

const groqApiKey = process.env.GROQ_API_KEY;
const groq = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;

if (groqApiKey) {
  console.log("🚀 Groq AI: Ready (llama-3.1-8b-instant) — token-efficient mode");
} else {
  console.warn("⚠️  GROQ_API_KEY not set — Groq provider disabled");
}

// ─── Gemini Client (Fallback) ───────────────────────────────────

const geminiApiKey = process.env.GEMINI_API_KEY;
const gemini = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

if (geminiApiKey) {
  console.log("🔮 Gemini AI: Ready (gemini-2.0-flash) — fallback");
} else {
  console.warn("⚠️  GEMINI_API_KEY not set — Gemini provider disabled");
}

// ─── Provider Selection ─────────────────────────────────────────
// Priority: Groq (free, fast) > Gemini > Mock
type AIProvider = "groq" | "gemini" | "mock";

function getProvider(): AIProvider {
  if (process.env.USE_MOCK_AI === "true") return "mock";
  if (groq) return "groq";
  if (gemini) return "gemini";
  return "mock";
}

// ─── Types ──────────────────────────────────────────────────────

export interface StoryGenerationResult {
  story_text: string;
  stat_changes: Record<string, number>;
  choices: { label: string; action: string }[];
  new_items?: {
    id: string;
    name: string;
    description?: string;
    rarity?: "Gray" | "Blue" | "Purple" | "Gold" | string;
    type?: string;
  }[];
}

// ─── Model Config ───────────────────────────────────────────────
// llama-3.1-8b-instant: Smallest & fastest model, most token-efficient on Groq free tier
const GROQ_MODEL = "llama-3.1-8b-instant";
const GEMINI_MODEL = "gemini-2.0-flash";
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 10_000;

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

// ─── System Instruction ─────────────────────────────────────────

function getSystemInstruction(worldSettings?: { plane: string; cultivationPath: string; realmSystem: string } | null, currentRealm?: string | null) {
  const plane = worldSettings?.plane || 'Nhân Giới';
  const cultivationPath = worldSettings?.cultivationPath || 'Pháp Tu';
  const realmSystem = worldSettings?.realmSystem || 'Cổ Điển';
  
  const realmContext = currentRealm 
    ? `The player's current cultivation realm is ${currentRealm}. Scale the enemies, terminology, and stakes to match this realm. A Golden Core (Kim Đan) cultivator should face entirely different threats than a Qi Condensation (Luyện Khí) cultivator.`
    : `The player is currently in the initial cultivation realm (Luyện Khí Kỳ). Scale threats appropriately.`;

  return `You are a Dark Fantasy Cultivation Game Master for the game "Tu Tiên Giới: Huyền Huyễn Kỷ" (The Cultivation World: Dark Fantasy Era).

The player is currently in the ${plane}. Their cultivation path is ${cultivationPath}. The realm progression system follows this pattern: ${realmSystem}. STRICTLY enforce the combat logic and narrative style of this specific cultivation path (e.g., Sword cultivators use sharp, lethal attacks; Body cultivators rely on physical toughness and melee). Ensure the environment matches the chosen plane.

${realmContext}

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
  ],
  "new_items": [
    { "id": "item_id_123", "name": "Bồi Nguyên Đan", "description": "Đan dược", "rarity": "Blue", "type": "consumable" }
  ]
}`;
}

// ─── Groq Generation ────────────────────────────────────────────

async function generateWithGroq(systemInstruction: string, userPrompt: string, jsonMode: boolean): Promise<string> {
  if (!groq) throw new Error("Groq client not initialized");

  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 4096,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      });

      const text = completion.choices[0]?.message?.content;
      if (!text) throw new Error("Groq returned empty response");
      return text;
    } catch (error: unknown) {
      lastError = error;
      const errorMsg = error instanceof Error ? error.message : String(error);
      const isRateLimit = errorMsg.includes("429") || errorMsg.includes("rate_limit");

      if (isRateLimit && attempt < MAX_RETRIES) {
        const retryDelay = extractRetryDelay(error) ?? BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `⚠️  [Groq] Rate limited (attempt ${attempt + 1}/${MAX_RETRIES}). ` +
          `Retrying in ${Math.round(retryDelay / 1000)}s...`
        );
        await sleep(retryDelay);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

// ─── Gemini Generation ──────────────────────────────────────────

async function generateWithGemini(systemInstruction: string, userPrompt: string, jsonMode: boolean): Promise<string> {
  if (!gemini) throw new Error("Gemini client not initialized");

  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await gemini.models.generateContent({
        model: GEMINI_MODEL,
        contents: userPrompt,
        config: {
          systemInstruction,
          ...(jsonMode ? { responseMimeType: "application/json" } : {}),
        },
      });

      const text = response.text;
      if (!text) throw new Error("Gemini returned empty response");
      return text;
    } catch (error: unknown) {
      lastError = error;
      const errorMsg = error instanceof Error ? error.message : String(error);
      const isRateLimit = errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED");

      if (isRateLimit && attempt < MAX_RETRIES) {
        const retryDelay = extractRetryDelay(error) ?? BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `⚠️  [Gemini] Rate limited (attempt ${attempt + 1}/${MAX_RETRIES}). ` +
          `Retrying in ${Math.round(retryDelay / 1000)}s...`
        );
        await sleep(retryDelay);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

// ─── Unified Generate (with auto-fallback) ──────────────────────

async function generate(systemInstruction: string, userPrompt: string, jsonMode: boolean): Promise<string> {
  const provider = getProvider();

  // Try primary provider
  if (provider === "groq") {
    try {
      return await generateWithGroq(systemInstruction, userPrompt, jsonMode);
    } catch (error) {
      console.warn(`⚠️  [Groq] Failed, falling back to Gemini:`, error instanceof Error ? error.message : error);
      // Fallback to Gemini
      if (gemini) {
        return await generateWithGemini(systemInstruction, userPrompt, jsonMode);
      }
      throw error;
    }
  }

  if (provider === "gemini") {
    try {
      return await generateWithGemini(systemInstruction, userPrompt, jsonMode);
    } catch (error) {
      console.warn(`⚠️  [Gemini] Failed, falling back to Groq:`, error instanceof Error ? error.message : error);
      // Fallback to Groq
      if (groq) {
        return await generateWithGroq(systemInstruction, userPrompt, jsonMode);
      }
      throw error;
    }
  }

  throw new Error("No AI provider available. Set GROQ_API_KEY or GEMINI_API_KEY.");
}

// ─── Generate Story ─────────────────────────────────────────────

export async function generateStoryNode(params: {
  characterName: string;
  characterBackground: string | null;
  cheatSystem: string | null;
  currentStats: Record<string, number>;
  actionTaken: string | null;
  previousContent: string | null;
  worldSettings?: { plane: string; cultivationPath: string; realmSystem: string } | null;
  currentRealm?: string | null;
}): Promise<StoryGenerationResult> {
  const provider = getProvider();

  if (provider === "mock") {
    if (params.actionTaken === "die") {
      return {
        story_text: "Chưa kịp định thần, một luồng Hỗn Độn Thần Lôi vô cớ giáng xuống. Hỏa độc thiêu rụi tâm can, huyết dịch trào ngược... Mọi thứ hóa thành tro bụi.",
        stat_changes: { hp: -9999, luck: -100 },
        choices: []
      };
    }

    return {
      story_text:
        "[CHẾ ĐỘ GIẢ LẬP] Trước mặt ngươi là thiên địa mịt mờ. " +
        "Thiên Đạo ban cho ngươi một phần cơ duyên từ hệ thống giả lập để thử nghiệm độ bền của không gian trữ vật.",
      stat_changes: { strength: 5, hp: 10, luck: 2 },
      choices: [
        { label: "Tiếp tục phân tích túi đồ", action: "continue" },
        { label: "Sát phạt đoạt bảo", action: "fight" },
        { label: "Tẩu hoả nhập ma (Test Vẫn Lạc)", action: "die" },
      ],
      new_items: [
        { id: `mock_${Date.now()}_1`, name: "Hỗn Độn Linh Tuyền", rarity: "Blue", description: "Linh tuyền tinh khiết, có thể tẩy cân phạt tủy." },
        { id: `mock_${Date.now()}_2`, name: "Tàn Quyết Cửu Dương", rarity: "Purple", description: "Sách kỹ năng cổ xưa, hỏa diễm bá đạo." },
        { id: `mock_${Date.now()}_3`, name: "Tru Tiên Cổ Kiếm", rarity: "Gold", description: "Kiếm gãy của vị Tiên Đế viễn cổ, sát khí hừng hực." }
      ]
    };
  }

  const systemInstruction = getSystemInstruction(params.worldSettings, params.currentRealm);
  const userPrompt = buildUserPrompt(params);

  const text = await generate(systemInstruction, userPrompt, true);
  const parsed: StoryGenerationResult = JSON.parse(text);

  // Validate the response structure
  if (!parsed.story_text || !Array.isArray(parsed.choices)) {
    throw new Error("Invalid AI response structure");
  }

  return parsed;
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

// ─── Web Novel AI Writer ────────────────────────────────────────

export async function generateChapterText(params: {
  title: string;
  synopsis: string | null;
  genre: string | null;
  tags: string[];
  prompt: string;
}): Promise<string> {
  const provider = getProvider();

  if (provider === "mock") {
    return `[MOCK AI] Đạo hữu vui lòng gắn GROQ_API_KEY hoặc GEMINI_API_KEY.\nDựa theo yêu cầu gốc của bạn: "${params.prompt}", đây là đoạn tự tạo ngẫu nhiên: Giữa tiếng sấm sét nổ nát không gian, một đường kiếm quang xé rách thương khung giáng xuống...`;
  }

  const systemInstruction = `You are an elite Xianxia (Tu Tiên) Web Novel co-author.
Your task is to write a chapter or a story segment based on the author's outline or prompt.

Style Requirements:
- Write in elegant, sophisticated Vietnamese, heavily influenced by Cultivation/Xianxia terminology (e.g., using terms like Đạo tâm, Thiên Kiếp, Cảnh giới, Thần thức, Pháp lực...).
- Write beautifully with "Show, don't tell". Describe the atmosphere, the overwhelming pressure of a high-realm cultivator, the sharpness of sword arts, and the profound mysteries of the Heavenly Dao.
- Output ONLY the raw story text. DO NOT use markdown headers (like # or ##). DO NOT add intro/outro comments. Just write the story in paragraphs.

Context of the Novel being written:
- Title: ${params.title}
- Genre: ${params.genre || "Tiên Hiệp"}
- Tags: ${params.tags?.length ? params.tags.join(", ") : "N/A"}
- Synopsis (if any): ${params.synopsis || "N/A"}`;

  const userPrompt = `Hãy diễn giải ý chính sau thành một phân đoạn truyện thật nhập vai và hoành tráng:\n\n${params.prompt}`;

  try {
    return await generate(systemInstruction, userPrompt, false);
  } catch (error) {
    console.error("AI Writer Error:", error);
    throw error;
  }
}
