// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  🐉 THIÊN ĐẠO SCRAPER ENGINE — Trung Tâm Điều Khiển Cào Truyện
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
//  Engine chính xử lý toàn bộ luồng cào truyện:
//  1. Nhận diện nguồn tự động từ URL
//  2. Lấy thông tin truyện + danh sách chương
//  3. Cào từng chương với rate limiting
//  4. Lưu ra file (.txt / .json) và/hoặc database
//  5. Theo dõi tiến trình, tự động resume nếu bị dừng giữa chừng
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import path from "path";
import type { ScraperConfig, ScrapeProgress, ChapterData, ChapterLink } from "./types.js";
import { detectAdapter, getSupportedSources } from "./adapters/index.js";
import {
  log,
  logBanner,
  logProgress,
  randomDelay,
  saveChapterToTxt,
  saveChapterToJson,
  saveNovelMetadata,
  loadProgress,
  saveProgress,
  appendToLogFile,
  ensureDir,
} from "./utils.js";

// ─── Default Config ──────────────────────────────────────────

export const DEFAULT_CONFIG: ScraperConfig = {
  tocUrl: "",
  saveToFile: true,
  saveToDb: false,
  outputDir: path.resolve("scraped_novels"),
  maxChapters: 0,      // 0 = cào tất cả
  startChapter: 1,
  delayMs: 2000,        // 2 giây giữa mỗi request
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  outputFormat: "txt",
};

// ─── Database Writer (nếu saveToDb = true) ───────────────────

async function saveChapterToDatabase(storyId: string, chapter: ChapterData): Promise<void> {
  // Dynamic import để tránh lỗi khi không dùng DB
  const { db, schema } = await import("../../db/index.js");
  
  await db.insert(schema.chapters).values({
    storyId,
    chapterNumber: chapter.chapterNumber,
    title: chapter.title,
    content: chapter.content,
    wordCount: chapter.wordCount,
    isPublished: 1,
  });
}

async function getOrCreateStoryInDb(novelInfo: { title: string; author: string; synopsis: string; genre: string; tags: string[] }): Promise<string> {
  const { db, schema } = await import("../../db/index.js");
  const { eq } = await import("drizzle-orm");

  // Tìm story đã tồn tại
  const existing = await db.select().from(schema.stories).where(eq(schema.stories.title, novelInfo.title)).limit(1);
  if (existing.length > 0) {
    log("info", `Đã tồn tại trong DB: "${novelInfo.title}" (ID: ${existing[0]!.id})`);
    return existing[0]!.id;
  }

  // Lấy user đầu tiên làm author
  const users = await db.select().from(schema.users).limit(1);
  const authorId = users.length > 0 ? users[0]!.id : "00000000-0000-0000-0000-000000000000";

  const [newStory] = await db.insert(schema.stories).values({
    authorId,
    title: novelInfo.title,
    synopsis: novelInfo.synopsis,
    genre: novelInfo.genre.toLowerCase(),
    status: "published",
    tags: novelInfo.tags,
  }).returning();

  log("success", `Đã tạo mới truyện trong DB: "${novelInfo.title}"`);
  return newStory!.id;
}

// ─── MAIN ENGINE ─────────────────────────────────────────────

export async function runScraper(userConfig: Partial<ScraperConfig>): Promise<void> {
  const config: ScraperConfig = { ...DEFAULT_CONFIG, ...userConfig };

  // Validate
  if (!config.tocUrl) {
    console.error("❌ Thiếu URL mục lục truyện! Hãy cung cấp tocUrl.");
    process.exit(1);
  }

  logBanner("THIÊN ĐẠO SCRAPER ENGINE v2.0");
  log("info", `URL mục tiêu: ${config.tocUrl}`);
  log("info", `Lưu file: ${config.saveToFile ? "✅" : "❌"} | Lưu DB: ${config.saveToDb ? "✅" : "❌"}`);
  log("info", `Format: ${config.outputFormat} | Delay: ${config.delayMs}ms`);

  // 1. AUTO-DETECT SOURCE
  const adapter = detectAdapter(config.tocUrl);
  log("success", `Nhận diện nguồn: ${adapter.name}`);

  // 2. FETCH NOVEL INFO
  const novelInfo = await adapter.fetchNovelInfo(config.tocUrl, config);
  console.log(`\n  📚 Tên truyện: ${novelInfo.title}`);
  console.log(`  ✍️  Tác giả:   ${novelInfo.author}`);
  console.log(`  📂 Thể loại:  ${novelInfo.genre}`);
  if (novelInfo.totalChapters) {
    console.log(`  📖 Tổng chương: ${novelInfo.totalChapters}`);
  }
  console.log("");

  // 3. FETCH CHAPTER LIST
  const allChapters = await adapter.fetchChapterList(config.tocUrl, config);
  if (allChapters.length === 0) {
    log("error", "Không tìm thấy chương nào! Kiểm tra lại URL hoặc CSS selectors.");
    return;
  }

  // 4. FILTER CHAPTERS (startChapter, maxChapters)
  let chaptersToScrape = allChapters.slice(config.startChapter - 1);
  if (config.maxChapters > 0) {
    chaptersToScrape = chaptersToScrape.slice(0, config.maxChapters);
  }

  // 5. CHECK PROGRESS (Resume support)
  if (config.saveToFile) {
    ensureDir(config.outputDir);
    saveNovelMetadata(config.outputDir, novelInfo);
  }

  const existingProgress = config.saveToFile ? loadProgress(config.outputDir, novelInfo.title) : null;
  if (existingProgress && existingProgress.completedChapters.length > 0) {
    const completed = new Set(existingProgress.completedChapters);
    const before = chaptersToScrape.length;
    chaptersToScrape = chaptersToScrape.filter(c => !completed.has(c.chapterNumber));
    log("info", `Resume mode: Bỏ qua ${before - chaptersToScrape.length} chương đã cào trước đó`);
  }

  if (chaptersToScrape.length === 0) {
    log("success", "Tất cả chương đã được cào trước đó! Không có gì để làm thêm.");
    return;
  }

  // 6. PREPARE DB (if needed)
  let dbStoryId: string | null = null;
  if (config.saveToDb) {
    try {
      dbStoryId = await getOrCreateStoryInDb(novelInfo);
    } catch (err: any) {
      log("error", `Không thể kết nối DB: ${err.message}. Tiếp tục chỉ lưu file.`);
      config.saveToDb = false;
    }
  }

  // 7. SCRAPE LOOP
  logBanner(`BẮT ĐẦU CÀO ${chaptersToScrape.length} CHƯƠNG`);
  
  const progress: ScrapeProgress = existingProgress || {
    tocUrl: config.tocUrl,
    novelTitle: novelInfo.title,
    totalChapters: allChapters.length,
    completedChapters: [],
    lastScrapedAt: new Date().toISOString(),
    errors: [],
  };

  let successCount = 0;
  let errorCount = 0;
  const startTime = Date.now();

  for (let i = 0; i < chaptersToScrape.length; i++) {
    const chapterLink = chaptersToScrape[i]!;
    
    try {
      // Cào nội dung chương
      const chapterData = await adapter.fetchChapterContent(chapterLink, config);

      if (!chapterData.content || chapterData.content.length < 50) {
        log("warn", `Chương ${chapterLink.chapterNumber} nội dung quá ngắn (${chapterData.content.length} ký tự), bỏ qua.`, chapterLink.chapterNumber);
        progress.errors.push({
          chapterNumber: chapterLink.chapterNumber,
          error: "Nội dung quá ngắn",
          timestamp: new Date().toISOString(),
        });
        errorCount++;
        continue;
      }

      // Lưu ra file
      if (config.saveToFile) {
        if (config.outputFormat === "txt" || config.outputFormat === "both") {
          saveChapterToTxt(config.outputDir, novelInfo.title, chapterData);
        }
        if (config.outputFormat === "json" || config.outputFormat === "both") {
          saveChapterToJson(config.outputDir, novelInfo.title, chapterData);
        }
      }

      // Lưu vào DB
      if (config.saveToDb && dbStoryId) {
        try {
          await saveChapterToDatabase(dbStoryId, chapterData);
        } catch (dbErr: any) {
          log("warn", `Lỗi lưu DB chương ${chapterLink.chapterNumber}: ${dbErr.message}`, chapterLink.chapterNumber);
        }
      }

      // Cập nhật progress
      progress.completedChapters.push(chapterLink.chapterNumber);
      successCount++;

      // Log progress
      logProgress(i + 1, chaptersToScrape.length, chapterData.title);
      log("success", `${chapterData.wordCount.toLocaleString("vi-VN")} từ | ${chapterData.content.length.toLocaleString("vi-VN")} ký tự`, chapterLink.chapterNumber);

      // Log to file
      if (config.saveToFile) {
        appendToLogFile(config.outputDir, novelInfo.title, {
          timestamp: new Date().toISOString(),
          level: "success",
          message: `Đã cào: ${chapterData.title} (${chapterData.wordCount} từ)`,
          chapterNumber: chapterLink.chapterNumber,
        });
        // Lưu progress mỗi chương (để có thể resume)
        saveProgress(config.outputDir, progress);
      }

    } catch (err: any) {
      errorCount++;
      log("error", `Lỗi cào chương ${chapterLink.chapterNumber}: ${err.message}`, chapterLink.chapterNumber);
      
      progress.errors.push({
        chapterNumber: chapterLink.chapterNumber,
        error: err.message,
        timestamp: new Date().toISOString(),
      });

      if (config.saveToFile) {
        appendToLogFile(config.outputDir, novelInfo.title, {
          timestamp: new Date().toISOString(),
          level: "error",
          message: `Lỗi: ${err.message}`,
          chapterNumber: chapterLink.chapterNumber,
        });
        saveProgress(config.outputDir, progress);
      }
    }

    // Rate limiting (trừ chương cuối)
    if (i < chaptersToScrape.length - 1) {
      await randomDelay(config.delayMs);
    }
  }

  // 8. FINAL SUMMARY
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  logBanner("KẾT QUẢ CÀO TRUYỆN");
  console.log(`  📚 Truyện:     ${novelInfo.title}`);
  console.log(`  ✅ Thành công: ${successCount} chương`);
  console.log(`  ❌ Lỗi:        ${errorCount} chương`);
  console.log(`  ⏱️  Thời gian:  ${elapsed} giây`);
  
  if (config.saveToFile) {
    console.log(`  📁 Thư mục:    ${config.outputDir}`);
  }
  if (config.saveToDb && dbStoryId) {
    console.log(`  🗄️  DB Story ID: ${dbStoryId}`);
  }
  
  console.log("");
  
  if (errorCount > 0) {
    log("warn", `Có ${errorCount} chương bị lỗi. Chạy lại lệnh để auto-resume những chương còn thiếu.`);
  } else {
    log("success", "🎉 HOÀN TẤT! Tất cả chương đã được cào mượt mà!");
  }
}

export { detectAdapter, getSupportedSources };
