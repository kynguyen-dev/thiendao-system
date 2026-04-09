import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";

const TARGET_URL = "http://vietnamthuquan.eu/(X(1)S(5zdfjt45obk3w245kaityq55))/truyen/truyen.aspx?tid=2qtqv3m3237nnn1n0nnn4n31n343tq83a3q3m3237nvn#phandau";

async function scrapeVNThuQuan() {
  console.log(`🚀 Bắt đầu phân tích vnThuQuan: ${TARGET_URL}\n`);
  
  try {
    const { data: html } = await axios.get(TARGET_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
    });
    const $ = cheerio.load(html);

    let rawTitle = $("title").text().trim();
    const titleMatch = rawTitle.match(/tác phẩm:\s*(.*?),/i) || rawTitle.match(/tác phẩm:\s*(.*)/i);
    const novelName = titleMatch ? titleMatch[1].trim() : "Không Tên";

    // Vietnamthuquan specific parsing for story content: looks for div.pcalibr or a table holding content
    let bestText = "";
    $("div, td, font").each((i, el) => {
        const text = $(el).text().trim();
        if (el.tagName !== 'body' && el.tagName !== 'html') {
            if (text.length > bestText.length) {
                bestText = text;
            }
        }
    });

    const cleanContent = bestText
        .replace(/\t/g, "")
        .replace(/\r/g, "")
        .replace(/\n\s*\n/g, "\n\n")
        .trim();

    const outputLog = `📌 Tên truyện: ${novelName}\n\n` +
                      `📖 NỘI DUNG CHƯƠNG TÌM THẤY (${cleanContent.length} ký tự):\n\n` +
                      `${cleanContent.substring(0, 1500)}...\n\n(Và còn ${cleanContent.length - 1500} ký tự nữa...)`;
    
    fs.writeFileSync("scrape_result.txt", outputLog, "utf-8");
    console.log("✅ Đã ghi kết quả ra file scrape_result.txt");
    
  } catch (error: any) {
    console.error("❌ Lỗi Scraper:", error.message);
  }
}

scrapeVNThuQuan();
