// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  🔌 SOURCE ADAPTER: TRUYENFULL.VN
//     Cào truyện từ TruyenFull (truyenfull.vn / truyenfull.io)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import axios from "axios";
import * as cheerio from "cheerio";
import type { SourceAdapter, NovelInfo, ChapterLink, ChapterData, ScraperConfig } from "../types.js";
import { cleanText, countWords, log } from "../utils.js";

export const truyenFullAdapter: SourceAdapter = {
  name: "TruyenFull",
  urlPattern: /truyenfull\.(vn|io|com)/i,

  async fetchNovelInfo(tocUrl: string, config: ScraperConfig): Promise<NovelInfo> {
    log("info", `Đang lấy thông tin truyện từ TruyenFull...`);
    const { data: html } = await axios.get(tocUrl, {
      headers: { "User-Agent": config.userAgent },
    });
    const $ = cheerio.load(html);

    const title = $("h3.title").text().trim() || $("h1").text().trim() || "Truyện Vô Danh";
    const author = $("a[itemprop='author']").text().trim() || $(".info h3:contains('Tác giả')").next("a").text().trim() || "Không rõ";
    const synopsis = $(".desc-text").text().trim() || $("[itemprop='description']").text().trim() || "";
    const coverImageUrl = $(".books img").attr("src") || $(".book img").attr("src") || undefined;
    const genre = $(".info a[itemprop='genre']").first().text().trim() || "Tiên Hiệp";
    
    const tags: string[] = [];
    $(".info a[itemprop='genre']").each((_, el) => {
      tags.push($(el).text().trim());
    });

    // Lấy tổng số chương
    const totalText = $(".l-chapter .l-chapter-total, .col-xs-12:contains('chương')").text();
    const totalMatch = totalText.match(/(\d+)\s*chương/i);
    const totalChapters = totalMatch ? parseInt(totalMatch[1]!) : undefined;

    return {
      title,
      author,
      synopsis,
      coverImageUrl,
      genre,
      tags,
      totalChapters,
      sourceUrl: tocUrl,
      sourceSite: "TruyenFull",
    };
  },

  async fetchChapterList(tocUrl: string, config: ScraperConfig): Promise<ChapterLink[]> {
    log("info", `Đang lấy danh sách chương từ TruyenFull...`);
    const chapters: ChapterLink[] = [];
    
    // TruyenFull phân trang mục lục, cần duyệt nhiều trang
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const pageUrl = page === 1 ? tocUrl : `${tocUrl.replace(/\/$/, "")}/trang-${page}/#list-chapter`;
      
      try {
        const { data: html } = await axios.get(pageUrl, {
          headers: { "User-Agent": config.userAgent },
        });
        const $ = cheerio.load(html);

        const links = $(".list-chapter li a, #list-chapter li a");
        if (links.length === 0) {
          hasMore = false;
          break;
        }

        links.each((_, el) => {
          const href = $(el).attr("href");
          const text = $(el).text().trim();
          if (href && text) {
            const numMatch = text.match(/Chương\s+(\d+)/i);
            const chapNum = numMatch ? parseInt(numMatch[1]!) : chapters.length + 1;
            
            // Tạo absolute URL
            const fullUrl = href.startsWith("http") ? href : new URL(href, tocUrl).href;
            
            chapters.push({
              url: fullUrl,
              title: text,
              chapterNumber: chapNum,
            });
          }
        });

        // Check trang tiếp
        const nextPageLink = $(".pagination li.active + li a, .pagination .next a");
        hasMore = nextPageLink.length > 0;
        page++;

        // Rate limit giữa các trang mục lục
        if (hasMore) {
          await new Promise(r => setTimeout(r, 500));
        }
      } catch {
        hasMore = false;
      }
    }

    log("success", `Tìm thấy ${chapters.length} chương từ TruyenFull`);
    return chapters;
  },

  async fetchChapterContent(chapterLink: ChapterLink, config: ScraperConfig): Promise<ChapterData> {
    const { data: html } = await axios.get(chapterLink.url, {
      headers: { "User-Agent": config.userAgent },
    });
    const $ = cheerio.load(html);

    // Lấy tiêu đề chương
    const title = $(".chapter-title, .chapter-c-title, h2").first().text().trim() || chapterLink.title;

    // Lấy nội dung — TruyenFull dùng class .chapter-c
    // Xóa quảng cáo trước khi lấy text
    $(".chapter-c .ads, .chapter-c script, .chapter-c .ad-wrapper").remove();
    
    const contentHtml = $(".chapter-c, #chapter-c").html();
    let content = "";
    
    if (contentHtml) {
      // Chuyển <br> thành \n, <p> thành \n\n
      const processed = contentHtml
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<[^>]+>/g, ""); // Xoá tất cả tag còn lại
      
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
