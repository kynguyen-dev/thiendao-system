import axios from "axios";
import * as cheerio from "cheerio";
import { db, schema } from "../db/index.js";
import { eq } from "drizzle-orm";

// ----------------------------------------------------------------------------
// CẤU HÌNH CÀO DỮ LIỆU
// ----------------------------------------------------------------------------
const TARGET_TOC_URL = "http://vietnamthuquan.eu/(X(1)S(5zdfjt45obk3w245kaityq55))/truyen/truyen.aspx?tid=2qtqv3m3237nnn1n0nnn4n31n343tq83a3q3m3237nvn";
const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000"; // ID của hệ thống/admin trong bảng users
const MAX_CHAPTERS_TO_SCRAPE = 9999; // Để thử nghiệm, chỉnh thành 9999 nếu muốn cào Full truyện
const DELAY_BETWEEN_REQUESTS_MS = 2000; // Nghỉ 2 giây giữa mỗi lần request để tránh bị khóa IP
// ----------------------------------------------------------------------------

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeFullNovel() {
  console.log(`\n🚀 BẮT ĐẦU CÀO HÀNG LOẠT: ${TARGET_TOC_URL}\n`);

  try {
    // 1. LẤY GIAO DIỆN MỤC LỤC & THÔNG TIN TRUYỆN
    const { data: html } = await axios.get(TARGET_TOC_URL, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    const $ = cheerio.load(html);

    // Tách tên truyện
    let rawTitle = $("title").text().trim();
    const titleMatch = rawTitle.match(/tác phẩm:\s*(.*?),/i) || rawTitle.match(/tác phẩm:\s*(.*)/i);
    const novelName = titleMatch ? titleMatch[1].trim() : "Tiên Hiệp Ẩn Danh";
    console.log(`📌 Đã tìm thấy tên truyện: ${novelName}`);

    // Truy tìm tất cả các thẻ Li có chứa hàm noidung1('tuaid=...&chuongid=...')
    const chapterList: { tuaid: string, chuongid: string, title: string }[] = [];
    
    $("li").each((i, el) => {
      const onClickStr = $(el).attr("onclick") || $(el).attr("onClick");
      if (onClickStr && onClickStr.includes("noidung1")) {
        // Regex: noidung1('tuaid=32038&chuongid=2')
        const match = onClickStr.match(/tuaid=(\d+)&chuongid=(\d+)/);
        if (match) {
           const chapterTitle = $(el).text().trim() || `Chương chưa rõ ${i}`;
           // VNTQ có nhiều link "#phandau" trùng nhau (VD: Mục phân trang), ta cần tránh trùng lặp
           if (!chapterList.find(c => c.chuongid === match[2])) {
              chapterList.push({
                tuaid: match[1],
                chuongid: match[2],
                title: chapterTitle
              });
           }
        }
      }
    });

    console.log(`📑 Phát hiện tống cộng ${chapterList.length} chương!`);
    if (chapterList.length === 0) {
        console.log("❌ Không tìm thấy danh sách chương, dừng thuật toán.");
        return;
    }

    // 2. KHỞI TẠO DỮ LIỆU VÀO DATABASE THIÊN ĐẠO HỆ THỐNG
    const systemUser = await db.select().from(schema.users).limit(1);
    const validAuthorId = systemUser.length > 0 ? systemUser[0].id : "00000000-0000-0000-0000-000000000000";

    let storyId = "";
    const existingStory = await db.select().from(schema.stories).where(eq(schema.stories.title, novelName)).limit(1);
    
    if (existingStory.length > 0) {
        storyId = existingStory[0].id;
        console.log(`📚 Cập nhật truyện đã có trong Data: ${novelName} (ID: ${storyId})`);
    } else {
        const [newStory] = await db.insert(schema.stories).values({
            authorId: validAuthorId,
            title: novelName,
            status: "published",
            synopsis: "Được cào tự động từ Việt Nam Thư Quán",
            genre: "Tiên Hiệp"
        }).returning();
        storyId = newStory.id;
        console.log(`📚 Đã tạo mới Tiểu thuyết vào hệ thống: ${novelName}`);
    }

    // 3. VÒNG LẶP CÀO VÀ INSERT CHƯƠNG (HÀNH ĐỘNG CÀO HÀNG LOẠT)
    const limitMax = Math.min(chapterList.length, MAX_CHAPTERS_TO_SCRAPE);
    console.log(`⏳ Bắt đầu chiến dịch cào ${limitMax} chương...\n`);
    
    const API_URL = "http://vietnamthuquan.eu/(X(1)S(5zdfjt45obk3w245kaityq55))/truyen/chuonghoi_moi.aspx";

    for (let i = 0; i < limitMax; i++) {
        const chapMeta = chapterList[i];
        console.log(`-> Đang cào [${chapMeta.title}] (chuongid: ${chapMeta.chuongid})...`);

        // Chuẩn bị Payload
        const payload = new URLSearchParams();
        payload.append('tuaid', chapMeta.tuaid);
        payload.append('chuongid', chapMeta.chuongid);

        try {
            const { data } = await axios.post(API_URL, payload.toString(), {
                headers: { "Content-Type": "application/x-www-form-urlencoded" }
            });

            const parts = data.split("--!!tach_noi_dung!!--");
            if (parts.length >= 3) {
                const $content = cheerio.load(parts[2]);
                $content('br').replaceWith('\\n'); 
                const decodedLineBreaks = ($content.html() || "").replace(/\\n/g, '\n').replace(/<br\s*\/?>/gi, '\n');
                const $finalText = cheerio.load(decodedLineBreaks);
                
                const pureText = $finalText.text()
                                    .replace(/\t/g, "")
                                    .replace(/\r/g, "")
                                    .replace(/\n\s*\n/g, "\n\n")
                                    .trim();

                const wordCount = pureText.split(/\s+/).length;

                // Thêm vào Database Drizzle ORM
                await db.insert(schema.chapters).values({
                    storyId: storyId,
                    chapterNumber: i + 1, // Thứ tự chương
                    title: chapMeta.title,
                    content: pureText,
                    wordCount: wordCount,
                    isPublished: 1
                });

                console.log(`   ✅ Thành công: ${pureText.length} ký tự. Đã Insert DB!`);
            } else {
                console.log(`   ❌ Thất bại: Cấu trúc HTML trả về bị hỏng.`);
            }
        } catch (err: any) {
            console.log(`   ❌ Lỗi Mạng: ${err.message}`);
        }

        // Tạm nghỉ chống Bot Protection
        if (i < limitMax - 1) {
            await delay(DELAY_BETWEEN_REQUESTS_MS);
        }
    }

    console.log(`\n🎉 HOÀN TẤT CHIẾN DỊCH CÀO HÀNG LOẠT! Các chương đã mượt mà chảy vào Hệ thống Thiên Đạo.`);
    
  } catch (error: any) {
    console.error("❌ Lỗi Tổng:", error.message);
  } finally {
    process.exit(0);
  }
}

scrapeFullNovel();
