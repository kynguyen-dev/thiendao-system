// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  🔌 SOURCE ADAPTER: VIỆT NAM THƯ QUÁN (vietnamthuquan.eu)
//     Đã được kiểm chứng hoạt động với Hidden AJAX API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import axios from "axios";
import * as cheerio from "cheerio";
import type { SourceAdapter, NovelInfo, ChapterLink, ChapterData, ScraperConfig } from "../types.js";
import { cleanText, countWords, log } from "../utils.js";

/** Tách session base URL từ VNTQ URL (cần giữ session ID) */
function getBaseUrl(tocUrl: string): string {
  // VNTQ URL có nested parentheses: (X(1)S(5zdfjt45obk3w245kaityq55))
  // Nên match tất cả trước /truyen/ thay vì parse parentheses  
  const match = tocUrl.match(/(https?:\/\/.*?)\/truyen\//);
  return match ? match[1]! : "http://vietnamthuquan.eu";
}

export const vntqAdapter: SourceAdapter = {
  name: "VietnamThuQuan",
  urlPattern: /vietnamthuquan\.(eu|com)/i,

  async fetchNovelInfo(tocUrl: string, config: ScraperConfig): Promise<NovelInfo> {
    log("info", `Đang lấy thông tin truyện từ Việt Nam Thư Quán...`);
    const { data: html } = await axios.get(tocUrl, {
      headers: { "User-Agent": config.userAgent },
    });
    const $ = cheerio.load(html);

    // Parse title từ <title> tag
    const rawTitle = $("title").text().trim();
    const titleMatch = rawTitle.match(/tác phẩm:\s*(.*?),/i) || rawTitle.match(/tác phẩm:\s*(.*)/i);
    const title = titleMatch ? titleMatch[1]!.trim() : "Tiên Hiệp Ẩn Danh";

    // Parse tác giả
    const authorMatch = rawTitle.match(/tác giả:\s*(.*?)$/i) || rawTitle.match(/tác giả:\s*(.*)/i);
    const author = authorMatch ? authorMatch[1]!.trim() : "Không rõ";

    return {
      title,
      author,
      synopsis: "Được cào tự động từ Việt Nam Thư Quán",
      genre: "Tiên Hiệp",
      tags: ["VNTQ", "Auto-Scraped"],
      sourceUrl: tocUrl,
      sourceSite: "VietnamThuQuan",
    };
  },

  async fetchChapterList(tocUrl: string, config: ScraperConfig): Promise<ChapterLink[]> {
    log("info", `Đang phân tích mục lục VNTQ (AJAX mode)...`);

    const { data: html } = await axios.get(tocUrl, {
      headers: { "User-Agent": config.userAgent },
    });
    const $ = cheerio.load(html);

    const chapterList: ChapterLink[] = [];

    // VNTQ dùng thẻ <li onclick="noidung1('tuaid=XXXX&chuongid=YY')">
    $("li").each((i, el) => {
      const onClickStr = $(el).attr("onclick") || $(el).attr("onClick") || "";
      if (onClickStr.includes("noidung1")) {
        const match = onClickStr.match(/tuaid=(\d+)&chuongid=(\d+)/);
        if (match) {
          const chapterTitle = $(el).text().trim() || `Chương ${i + 1}`;
          const chuongid = match[2]!;

          // Tránh trùng lặp
          if (!chapterList.find(c => c.url.includes(`chuongid=${chuongid}`))) {
            chapterList.push({
              url: `tuaid=${match[1]}&chuongid=${chuongid}`,
              title: chapterTitle,
              chapterNumber: chapterList.length + 1,
            });
          }
        }
      }
    });

    log("success", `Tìm thấy ${chapterList.length} chương từ VNTQ`);
    return chapterList;
  },

  async fetchChapterContent(chapterLink: ChapterLink, config: ScraperConfig): Promise<ChapterData> {
    // VNTQ cần POST tới hidden AJAX API
    const baseUrl = getBaseUrl(config.tocUrl);
    const apiUrl = `${baseUrl}/truyen/chuonghoi_moi.aspx`;

    // Parse tuaid và chuongid từ URL field
    const match = chapterLink.url.match(/tuaid=(\d+)&chuongid=(\d+)/);
    if (!match) {
      throw new Error(`Invalid VNTQ chapter URL: ${chapterLink.url}`);
    }

    const payload = new URLSearchParams();
    payload.append("tuaid", match[1]!);
    payload.append("chuongid", match[2]!);

    const { data } = await axios.post(apiUrl, payload.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": config.userAgent,
      },
    });

    // VNTQ trả về data phân tách bởi --!!tach_noi_dung!!--
    const parts = data.split("--!!tach_noi_dung!!--");
    if (parts.length < 3) {
      throw new Error(`VNTQ response format invalid for chapter ${chapterLink.chapterNumber}`);
    }

    // Part[1] = title HTML, Part[2] = content HTML
    const $content = cheerio.load(parts[2]);
    $content("br").replaceWith("\\n");

    const decodedLineBreaks = ($content.html() || "")
      .replace(/\\n/g, "\n")
      .replace(/<br\s*\/?>/gi, "\n");
    const $finalText = cheerio.load(decodedLineBreaks);

    const pureText = cleanText($finalText.text());
    const wordCount = countWords(pureText);

    // Parse title từ phần response
    // VNTQ title part chứa navigation rác, cần lọc
    const $title = cheerio.load(parts[1] || "");
    // Xoá navigation elements
    $title("a, select, option, input, button, script, style").remove();
    let rawTitle = $title.text().trim();
    // Lọc rác navigation: << Lui, -☆-, Tiến >>
    rawTitle = rawTitle
      .replace(/<<\s*Lui/g, "")
      .replace(/Tiến\s*>>/g, "")
      .replace(/-☆-/g, "")
      .replace(/Cỡ chữ\s*\d+/gi, "")
      .replace(/tình hà dĩ thậm/gi, "") // tên tác giả/subtitle thừa
      .replace(/\s+/g, " ")
      .trim();
    
    const title = rawTitle || chapterLink.title;

    return {
      chapterNumber: chapterLink.chapterNumber,
      title,
      content: pureText,
      wordCount,
      sourceUrl: chapterLink.url,
    };
  },
};
