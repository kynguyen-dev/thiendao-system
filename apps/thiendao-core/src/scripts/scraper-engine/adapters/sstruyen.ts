// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  🔌 SOURCE ADAPTER: SSTRUYEN.VN
//     Cào truyện từ SSTruyen (sstruyen.vn)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import axios from "axios";
import * as cheerio from "cheerio";
import type { SourceAdapter, NovelInfo, ChapterLink, ChapterData, ScraperConfig } from "../types.js";
import { cleanText, countWords, log } from "../utils.js";

export const ssTruyenAdapter: SourceAdapter = {
  name: "SSTruyen",
  urlPattern: /sstruyen\.(vn|com|net)/i,

  async fetchNovelInfo(tocUrl: string, config: ScraperConfig): Promise<NovelInfo> {
    log("info", `Đang lấy thông tin truyện từ SSTruyen...`);
    const { data: html } = await axios.get(tocUrl, {
      headers: { "User-Agent": config.userAgent },
    });
    const $ = cheerio.load(html);

    const title = $("h1, .truyen-title, .title").first().text().trim() || "Truyện Vô Danh";
    const author = $(".author a, .info a[href*='tac-gia']").first().text().trim() || "Không rõ";
    const synopsis = $(".desc-text, .story-desc, .description").text().trim() || "";
    const coverImageUrl = $(".book-img img, .cover img, .books img").attr("src") || undefined;
    const genre = $(".info a[href*='the-loai'], .genre a").first().text().trim() || "Tiên Hiệp";

    const tags: string[] = [];
    $(".info a[href*='the-loai'], .genre a, .tag a").each((_, el) => {
      tags.push($(el).text().trim());
    });

    return {
      title, author, synopsis, coverImageUrl, genre, tags,
      sourceUrl: tocUrl,
      sourceSite: "SSTruyen",
    };
  },

  async fetchChapterList(tocUrl: string, config: ScraperConfig): Promise<ChapterLink[]> {
    log("info", `Đang lấy danh sách chương từ SSTruyen...`);
    const chapters: ChapterLink[] = [];

    const { data: html } = await axios.get(tocUrl, {
      headers: { "User-Agent": config.userAgent },
    });
    const $ = cheerio.load(html);

    $(".list-chapter li a, #list-chapter li a, .chapter-list li a").each((i, el) => {
      const href = $(el).attr("href");
      const text = $(el).text().trim();
      if (href && text) {
        const fullUrl = href.startsWith("http") ? href : new URL(href, tocUrl).href;
        chapters.push({
          url: fullUrl,
          title: text,
          chapterNumber: i + 1,
        });
      }
    });

    log("success", `Tìm thấy ${chapters.length} chương từ SSTruyen`);
    return chapters;
  },

  async fetchChapterContent(chapterLink: ChapterLink, config: ScraperConfig): Promise<ChapterData> {
    const { data: html } = await axios.get(chapterLink.url, {
      headers: { "User-Agent": config.userAgent },
    });
    const $ = cheerio.load(html);

    const title = $("h1, .chapter-title, h2").first().text().trim() || chapterLink.title;
    $(".chapter-c script, .chapter-c .ads").remove();

    const contentHtml = $(".chapter-c, #chapter-c, .reading-content").html();
    let content = "";
    if (contentHtml) {
      content = cleanText(
        contentHtml
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<\/p>/gi, "\n\n")
          .replace(/<[^>]+>/g, "")
      );
    }

    return {
      chapterNumber: chapterLink.chapterNumber,
      title, content,
      wordCount: countWords(content),
      sourceUrl: chapterLink.url,
    };
  },
};
