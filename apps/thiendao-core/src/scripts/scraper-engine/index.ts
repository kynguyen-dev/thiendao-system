// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  🐉 THIÊN ĐẠO SCRAPER ENGINE — Public API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type {
  NovelInfo,
  ChapterData,
  ChapterLink,
  ScraperConfig,
  SourceAdapter,
  ScrapeProgress,
  ScrapeLogEntry,
} from "./types.js";

export { runScraper, DEFAULT_CONFIG, detectAdapter, getSupportedSources } from "./engine.js";
export { registerAdapter } from "./adapters/index.js";

// Re-export individual adapters for direct use
export { truyenFullAdapter } from "./adapters/truyenfull.js";
export { vntqAdapter } from "./adapters/vntq.js";
export { tangThuVienAdapter } from "./adapters/tangthuvien.js";
export { ssTruyenAdapter } from "./adapters/sstruyen.js";
