// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  📐 CÀO TRUYỆN ENGINE — TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Thông tin metadata của một truyện */
export interface NovelInfo {
  title: string;
  author: string;
  synopsis: string;
  coverImageUrl?: string;
  genre: string;
  tags: string[];
  totalChapters?: number;
  sourceUrl: string;
  sourceSite: string;
}

/** Thông tin của một chương */
export interface ChapterData {
  chapterNumber: number;
  title: string;
  content: string;
  wordCount: number;
  sourceUrl?: string;
}

/** Link chương trong mục lục */
export interface ChapterLink {
  url: string;
  title: string;
  chapterNumber: number;
}

/** Cấu hình scraper */
export interface ScraperConfig {
  /** URL mục lục truyện */
  tocUrl: string;
  /** Lưu ra file? */
  saveToFile: boolean;
  /** Lưu vào database? */
  saveToDb: boolean;
  /** Thư mục output (nếu saveToFile = true) */
  outputDir: string;
  /** Số chương tối đa cần cào (0 = tất cả) */
  maxChapters: number;
  /** Bắt đầu từ chương nào (1-indexed) */
  startChapter: number;
  /** Thời gian nghỉ giữa mỗi request (ms) */
  delayMs: number;
  /** User-Agent header */
  userAgent: string;
  /** Output format cho file */
  outputFormat: "txt" | "json" | "both";
}

/** Interface cho một Source Adapter (plugin pattern) */
export interface SourceAdapter {
  /** Tên nguồn (VD: "TruyenFull", "TangThuVien", "VNTQ") */
  name: string;
  /** Regex pattern để nhận diện URL thuộc nguồn này */
  urlPattern: RegExp;
  /** Lấy thông tin truyện từ trang mục lục */
  fetchNovelInfo(tocUrl: string, config: ScraperConfig): Promise<NovelInfo>;
  /** Lấy danh sách link các chương */
  fetchChapterList(tocUrl: string, config: ScraperConfig): Promise<ChapterLink[]>;
  /** Lấy nội dung một chương */
  fetchChapterContent(chapterLink: ChapterLink, config: ScraperConfig): Promise<ChapterData>;
}

/** Trạng thái progress để resume */
export interface ScrapeProgress {
  tocUrl: string;
  novelTitle: string;
  totalChapters: number;
  completedChapters: number[];
  lastScrapedAt: string;
  errors: Array<{ chapterNumber: number; error: string; timestamp: string }>;
}

/** Log entry */
export interface ScrapeLogEntry {
  timestamp: string;
  level: "info" | "warn" | "error" | "success";
  message: string;
  chapterNumber?: number;
}
