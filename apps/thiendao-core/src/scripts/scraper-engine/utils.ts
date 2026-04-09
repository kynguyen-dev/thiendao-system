// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  🛠️ UTILITY FUNCTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import fs from "fs";
import path from "path";
import type { ScrapeProgress, ScrapeLogEntry, NovelInfo, ChapterData } from "./types.js";

// ─── Console Colors ───────────────────────────────────────────

const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
} as const;

// ─── Logger ──────────────────────────────────────────────────

const LOG_ICONS = {
  info: `${COLORS.cyan}ℹ️ `,
  warn: `${COLORS.yellow}⚠️ `,
  error: `${COLORS.red}❌`,
  success: `${COLORS.green}✅`,
} as const;

export function log(level: ScrapeLogEntry["level"], message: string, chapterNum?: number): void {
  const now = new Date().toLocaleTimeString("vi-VN");
  const icon = LOG_ICONS[level];
  const chapterTag = chapterNum !== undefined ? `${COLORS.dim}[Ch.${chapterNum}]${COLORS.reset} ` : "";
  console.log(`${COLORS.dim}[${now}]${COLORS.reset} ${icon} ${chapterTag}${message}${COLORS.reset}`);
}

export function logBanner(title: string): void {
  const line = "━".repeat(60);
  console.log(`\n${COLORS.cyan}${line}`);
  console.log(`  🐉 ${COLORS.bright}${title}`);
  console.log(`${COLORS.cyan}${line}${COLORS.reset}\n`);
}

export function logProgress(current: number, total: number, chapterTitle: string): void {
  const percent = Math.round((current / total) * 100);
  const filled = Math.round(percent / 5);
  const empty = 20 - filled;
  const bar = `${COLORS.green}${"█".repeat(filled)}${COLORS.dim}${"░".repeat(empty)}${COLORS.reset}`;
  console.log(`  ${bar} ${COLORS.bright}${percent}%${COLORS.reset} (${current}/${total}) ${COLORS.dim}${chapterTitle}${COLORS.reset}`);
}

// ─── Delay ───────────────────────────────────────────────────

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Random delay trong khoảng [ms, ms * 1.5] để trông tự nhiên hơn */
export function randomDelay(baseMs: number): Promise<void> {
  const jitter = Math.random() * baseMs * 0.5;
  return delay(baseMs + jitter);
}

// ─── File System Helpers ─────────────────────────────────────

/** Đảm bảo thư mục tồn tại */
export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    log("info", `Đã tạo thư mục: ${dirPath}`);
  }
}

/** Tạo tên file an toàn cho tên truyện */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .substring(0, 100)
    .trim();
}

/** Lưu chapter ra file .txt */
export function saveChapterToTxt(outputDir: string, novelTitle: string, chapter: ChapterData): string {
  const novelDir = path.join(outputDir, sanitizeFilename(novelTitle));
  ensureDir(novelDir);

  const filename = `chuong_${String(chapter.chapterNumber).padStart(4, "0")}.txt`;
  const filePath = path.join(novelDir, filename);

  const content = [
    `═══════════════════════════════════════`,
    `  ${chapter.title}`,
    `  Số từ: ${chapter.wordCount.toLocaleString("vi-VN")}`,
    `═══════════════════════════════════════`,
    ``,
    chapter.content,
    ``,
    `── HẾT CHƯƠNG ${chapter.chapterNumber} ──`,
  ].join("\n");

  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

/** Lưu chapter ra file .json */
export function saveChapterToJson(outputDir: string, novelTitle: string, chapter: ChapterData): string {
  const novelDir = path.join(outputDir, sanitizeFilename(novelTitle));
  ensureDir(novelDir);

  const filename = `chuong_${String(chapter.chapterNumber).padStart(4, "0")}.json`;
  const filePath = path.join(novelDir, filename);

  fs.writeFileSync(filePath, JSON.stringify(chapter, null, 2), "utf-8");
  return filePath;
}

/** Lưu toàn bộ novel info ra file metadata */
export function saveNovelMetadata(outputDir: string, novelInfo: NovelInfo): void {
  const novelDir = path.join(outputDir, sanitizeFilename(novelInfo.title));
  ensureDir(novelDir);
  const filePath = path.join(novelDir, "_metadata.json");
  fs.writeFileSync(filePath, JSON.stringify(novelInfo, null, 2), "utf-8");
  log("info", `Đã lưu metadata: ${filePath}`);
}

// ─── Progress Tracking ───────────────────────────────────────

function getProgressFilePath(outputDir: string, novelTitle: string): string {
  const novelDir = path.join(outputDir, sanitizeFilename(novelTitle));
  ensureDir(novelDir);
  return path.join(novelDir, "_progress.json");
}

/** Đọc trạng thái cào từ file */
export function loadProgress(outputDir: string, novelTitle: string): ScrapeProgress | null {
  const filePath = getProgressFilePath(outputDir, novelTitle);
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw) as ScrapeProgress;
    } catch {
      return null;
    }
  }
  return null;
}

/** Lưu trạng thái cào ra file */
export function saveProgress(outputDir: string, progress: ScrapeProgress): void {
  const filePath = getProgressFilePath(outputDir, progress.novelTitle);
  progress.lastScrapedAt = new Date().toISOString();
  fs.writeFileSync(filePath, JSON.stringify(progress, null, 2), "utf-8");
}

/** Ghi nối vào file log */
export function appendToLogFile(outputDir: string, novelTitle: string, entry: ScrapeLogEntry): void {
  const novelDir = path.join(outputDir, sanitizeFilename(novelTitle));
  ensureDir(novelDir);
  const logPath = path.join(novelDir, "_scrape.log");
  const line = `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.chapterNumber !== undefined ? `[Ch.${entry.chapterNumber}] ` : ""}${entry.message}\n`;
  fs.appendFileSync(logPath, line, "utf-8");
}

// ─── Text Processing ─────────────────────────────────────────

/** Xử lý text thô thành text sạch */
export function cleanText(rawText: string): string {
  return rawText
    .replace(/\t/g, "")          // Xoá tab
    .replace(/\r/g, "")          // Xoá carriage return
    .split("\n")                  // Tách từng dòng
    .map(line => line.trim())     // Trim mỗi dòng
    .filter(line => {
      // Loại bỏ các dòng rác từ VNTQ navigation
      if (!line) return true;     // Giữ dòng trống (để tách đoạn)
      if (line.match(/^<<\s*Lui|Tiến\s*>>|^-☆-$/)) return false;
      if (line.match(/^Cỡ chữ\s*\d+/i)) return false;
      return true;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")  // Tối đa 2 dòng trống liên tiếp
    .trim();
}

/** Đếm số từ (tiếng Việt) */
export function countWords(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

/** Tạo slug từ tên truyện */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
