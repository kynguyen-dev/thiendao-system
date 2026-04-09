import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";

const TARGET_URL = "http://vietnamthuquan.eu/(X(1)S(5zdfjt45obk3w245kaityq55))/truyen/truyen.aspx?tid=2qtqv3m3237nnn1n0nnn4n31n343tq83a3q3m3237nvn#phandau";

async function exploreVNTQ() {
  console.log(`Dò tìm sâu cấu trúc: ${TARGET_URL}`);
  
  try {
    const { data: html } = await axios.get(TARGET_URL, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    
    fs.writeFileSync("vntq_raw_source.html", html, "utf-8");
    console.log("Đã lưu mã nguồn gốc vào vntq_raw_source.html!");
    
    const $ = cheerio.load(html);

    // Tìm tất cả các link Chương xem nó đi đâu
    const chapterLinks: string[] = [];
    $("a").each((i, el) => {
        const text = $(el).text().trim().toLowerCase();
        if (text.includes("chương 1") || text.includes("phần 1")) {
            chapterLinks.push(`${text}: ${$(el).attr('href')}`);
        }
    });

    // Dò tìm iframe hay thẻ script chứa nội dung
    const iframes = $("iframe").length;
    
    console.log("--- BÁO CÁO PHÂN TÍCH VNTQ ---");
    console.log(`- Có iframe không: ${iframes > 0 ? "CÓ" : "KHÔNG"}`);
    console.log("- Link các chương đầu tiên (Để xem nó chuyển trang hay load AJAX):");
    console.log(chapterLinks.slice(0, 5).join('\n'));
    
  } catch (error: any) {
    console.error("Lỗi:", error.message);
  }
}

exploreVNTQ();
