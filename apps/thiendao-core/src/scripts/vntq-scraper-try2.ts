import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";

const TARGET_URL = "http://vietnamthuquan.eu/(X(1)S(5zdfjt45obk3w245kaityq55))/truyen/truyen.aspx?tid=2qtqv3m3237nnn1n0nnn4n31n343tq83a3q3m3237nvn#phandau";

async function scrapeVNThuQuanBypass() {
  console.log(`🚀 Thử nghiệm giải pháp bóc tách đặc biệt cho VNTQ...`);
  
  try {
    const { data: html } = await axios.get(TARGET_URL, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    
    // Nạp HTML vào Cheerio
    const $ = cheerio.load(html);

    // 1. Tách tên truyện (Option 1: Lấy từ title regex)
    let rawTitle = $("title").text().trim();
    const titleMatch = rawTitle.match(/tác phẩm:\s*(.*?),/i) || rawTitle.match(/tác phẩm:\s*(.*)/i);
    const novelName = titleMatch ? titleMatch[1].trim() : "Không Tên";
    console.log(`📌 Lấy lại tên truyện: ${novelName}`);

    // 2. GIẢI PHÁP BẺ KHOÁ: Xóa sạch rác và Menu
    // Bởi vì VNTQ chứa mục lục toàn là thẻ <a> (Link), ta xóa thẻ <a> đi là mục lục sụp đổ!
    // Xóa luôn script, style, header rác...
    $("style, script, noscript, a, meta, link, select, option, input, button").remove();

    // Lấy toàn bộ text thô sơ cón sót lại sau khi đã xóa Link Menu
    let content = $("body").text();

    // 3. Tiền xử lý văn bản:
    // Tách thành từng dòng, lột sạch khoảng trắng ảo, xoá dòng HTML rác
    const lines = content.split('\n');
    let storyParagraphs: string[] = [];

    for (let line of lines) {
        let cleanLine = line.trim();
        
        // Loại bỏ các dòng quá ngắn (Ví dụ: "Trang chủ", "Tranh ảnh", v.v... không bị nằm trong The <a>)
        // Thông thường văn bản của truyện sẽ là các câu dài
        if (cleanLine.length > 30) {
            // VNTQ có thể có các chuỗi rác như "Cỡ chữ 18", v.v...
            if (!cleanLine.toLowerCase().includes("cỡ chữ")) {
                storyParagraphs.push(cleanLine);
            }
        }
    }

    const cleanContent = storyParagraphs.join('\n\n');

    const outputLog = `📌 Tên truyện: ${novelName}\n\n` +
                      `📖 NỘI DUNG SAU KHI LỌC RÁC (${cleanContent.length} ký tự):\n\n` +
                      `${cleanContent.substring(0, 2000)}...\n\n[...]`;
    
    fs.writeFileSync("scrape_result_sach_toi_da.txt", outputLog, "utf-8");
    console.log("✅ Đã bóc tách mượt mà! Lưu tại scrape_result_sach_toi_da.txt");
    
  } catch (error: any) {
    console.error("❌ Lỗi Scraper:", error.message);
  }
}

scrapeVNThuQuanBypass();
