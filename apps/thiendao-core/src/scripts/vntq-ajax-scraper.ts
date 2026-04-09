import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";

// Sử dụng lại Sessoin ID từ URL bạn cung cấp để ASP.NET không Redirect
const SESSION_URL = "http://vietnamthuquan.eu/(X(1)S(5zdfjt45obk3w245kaityq55))/truyen/chuonghoi_moi.aspx";

async function scrapeRealChapter() {
  console.log("🚀 Gọi API Ẩn của Vietnamthuquan để lấy Chương 1...");

  try {
    const payload = new URLSearchParams();
    payload.append('tuaid', '32038');
    payload.append('chuongid', '2');

    const { data } = await axios.post(SESSION_URL, payload.toString(), {
      headers: { 
        "User-Agent": "Mozilla/5.0",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
      }
    });

    console.log("✅ API trả về thành công!");

    const parts = data.split("--!!tach_noi_dung!!--");
    
    if (parts.length >= 3) {
      const titleHTML = parts[1];
      const contentHTML = parts[2];
      
      const $title = cheerio.load(titleHTML);
      const $content = cheerio.load(contentHTML);

      const chapterTitle = $title.text().trim() || "Chương 1: Thiên kiêu Đại Sở";
      
      $content('br').replaceWith('\\n'); // replace breaklines safely
      
      const decodedLineBreaks = ($content.html() || "").replace(/\\n/g, '\n').replace(/<br\s*\/?>/gi, '\n');
      const $finalText = cheerio.load(decodedLineBreaks);
      
      const pureText = $finalText.text()
                        .replace(/\t/g, "")
                        .replace(/\r/g, "")
                        .replace(/\n\s*\n/g, "\n\n")
                        .trim();

      const outputLog = `📌 CHƯƠNG: ${chapterTitle}\n` +
                        `=========================================\n\n` +
                        `${pureText}\n`;
      
      fs.writeFileSync("REAL_CHAPTER_1.txt", outputLog, "utf-8");
      console.log(`🎯 BÓC TÁCH HOÀN HẢO! Nội dung (${pureText.length} chữ) đã được lưu vào REAL_CHAPTER_1.txt`);
    } else {
      console.log("❌ Phản hồi từ server không giống dự kiến. Độ dài data: " + data.length);
    }

  } catch (error: any) {
    console.error("❌ Lỗi Scraper API:", error.message);
  }
}

scrapeRealChapter();
