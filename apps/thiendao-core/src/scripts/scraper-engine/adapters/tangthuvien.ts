// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  🔌 SOURCE ADAPTER: TANGTHUVIEN.VN
//     Cào truyện từ TangThuVien (truyen.tangthuvien.vn)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import axios from "axios";
import * as cheerio from "cheerio";
import type { SourceAdapter, NovelInfo, ChapterLink, ChapterData, ScraperConfig } from "../types.js";
import { cleanText, countWords, log } from "../utils.js";

export const tangThuVienAdapter: SourceAdapter = {
  name: "TangThuVien",
  urlPattern: /tangthuvien\.(vn|net|com)/i,

  async fetchNovelInfo(tocUrl: string, config: ScraperConfig): Promise<NovelInfo> {
    log("info", `Đang lấy thông tin truyện từ Tàng Thư Viện...`);
    const { data: html } = await axios.get(tocUrl, {
      headers: { "User-Agent": config.userAgent },
    });
    const $ = cheerio.load(html);

    const title = $("h1.book-title, .book-info h1").text().trim() || "Truyện Vô Danh";
    const author = $(".tag a[href*='tac-gia'], .book-info .author a").first().text().trim() || "Không rõ";
    const synopsis = $(".book-intro p, .book-content-wrap .book-intro").text().trim() || "";
    const coverImageUrl = $(".book-img img").attr("src") || undefined;
    const genre = $(".book-state a, .tag a[href*='the-loai']").first().text().trim() || "Tiên Hiệp";

    const tags: string[] = [];
    $(".tag a").each((_, el) => {
      const tagText = $(el).text().trim();
      if (tagText && !tagText.includes("Tác giả")) {
        tags.push(tagText);
      }
    });

    return {
      title,
      author,
      synopsis,
      coverImageUrl,
      genre,
      tags,
      sourceUrl: tocUrl,
      sourceSite: "TangThuVien",
    };
  },

  async fetchChapterList(tocUrl: string, config: ScraperConfig): Promise<ChapterLink[]> {
    log("info", `Đang lấy danh sách chương từ Tàng Thư Viện...`);
    const chapters: ChapterLink[] = [];

    // TTV thường có API riêng để lấy danh sách chương
    // Thử qua trang mục lục trước
    const { data: html } = await axios.get(tocUrl, {
      headers: { "User-Agent": config.userAgent },
    });
    const $ = cheerio.load(html);

    // Lấy story_id từ trang
    const storyId = $("[data-story-id]").attr("data-story-id") || 
                    tocUrl.match(/\/(\d+)$/)?.[1] || "";

    // Nếu có story_id, dùng API
    if (storyId) {
      try {
        const apiUrl = `https://truyen.tangthuvien.vn/doc-truyen/page/${storyId}?page=0&limit=9999`;
        const { data: apiHtml } = await axios.get(apiUrl, {
          headers: { "User-Agent": config.userAgent },
        });
        const $api = cheerio.load(apiHtml);

        $api("li a, ul.cf li a").each((i, el) => {
          const href = $api(el).attr("href");
          const text = $api(el).text().trim();
          if (href && text) {
            const fullUrl = href.startsWith("http") ? href : `https://truyen.tangthuvien.vn${href}`;
            chapters.push({
              url: fullUrl,
              title: text,
              chapterNumber: i + 1,
            });
          }
        });
      } catch (err) {
        log("warn", `Không thể dùng API TTV, fallback sang HTML parsing`);
      }
    }

    // Fallback: parse trực tiếp từ HTML mục lục
    if (chapters.length === 0) {
      $(".cf li a, #chapter-list li a, .list-chapter li a").each((i, el) => {
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
    }

    log("success", `Tìm thấy ${chapters.length} chương từ TangThuVien`);
    return chapters;
  },

  async fetchChapterContent(chapterLink: ChapterLink, config: ScraperConfig): Promise<ChapterData> {
    const { data: html } = await axios.get(chapterLink.url, {
      headers: { "User-Agent": config.userAgent },
    });
    const $ = cheerio.load(html);

    const title = $(".chapter-title, .truyen-title, h2").first().text().trim() || chapterLink.title;

    // Xóa quảng cáo
    $(".box-chap script, .box-chap .ads").remove();

    const contentHtml = $(".box-chap, .chapter-c, #chapter-content").html();
    let content = "";

    if (contentHtml) {
      const processed = contentHtml
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<[^>]+>/g, "");
      content = cleanText(processed);
    }

    return {
      chapterNumber: chapterLink.chapterNumber,
      title,
      content,
      wordCount: countWords(content),
      sourceUrl: chapterLink.url,
    };
  },
};
