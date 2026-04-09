import { db, schema } from "../db/index.js";
import { eq } from "drizzle-orm";
import axios from "axios";
import * as cheerio from "cheerio"; // Will need: npm i axios cheerio

// NOTE: This is a template based on typical structure of sites like TruyenFull.
// You must adjust the CSS selectors (.title, .chapter-c, etc.) to match the actual site you want to scrape.

const TARGET_URL = "https://example-truyen-site.com/truyen/tuyet-the-dai-dao";
const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000"; // Thay bằng ID của user admin/author của bạn

async function scrapeNovelData() {
  console.log(`🚀 Bắt đầu cào dữ liệu từ: ${TARGET_URL}`);
  
  try {
    // 1. Fetch Novel Main Page
    const { data: html } = await axios.get(TARGET_URL);
    const $ = cheerio.load(html);

    // 2. Parse Novel Metadata
    const title = $("h3.title").text().trim() || "Truyện Vô Danh";
    const authorName = $("a[itemprop='author']").text().trim() || "Thái Thượng Lão Quân";
    const synopsis = $(".desc-text").text().trim();
    const coverImage = $(".books img").attr("src");
    
    // Thể loại (Genre) - Ex: "Tiên Hiệp, Huyền Huyễn"
    const genre = $(".info a[itemprop='genre']").first().text().trim() || "Tiên Hiệp";
    
    console.log(`📌 Tên truyện: ${title}`);
    console.log(`📌 Tác giả: ${authorName}`);
    console.log(`📌 Bìa: ${coverImage}`);

    // 3. Database: Lưu hoặc cập nhật Tác Giả & Truyện
    // Note: Dùng user admin hiện tại hoặc tạo user bot
    let authorId = SYSTEM_USER_ID; 

    // Kiểm tra xem truyện đã tồn tại chưa (dựa theo tên)
    let storyRecord = await db.query.stories.findFirst({
        where: eq(schema.stories.title, title)
    });

    if (!storyRecord) {
        console.log("📝 Đang tạo dữ liệu truyện mới vào Database...");
        const [newStory] = await db.insert(schema.stories).values({
            authorId: authorId,
            title: title,
            synopsis: synopsis,
            coverImageUrl: coverImage,
            genre: genre.toLowerCase(),
            status: "published",
            tags: ["Scrape", genre],
        }).returning();
        storyRecord = newStory;
    } else {
        console.log("✅ Truyện đã tồn tại trong DB, ID:", storyRecord.id);
    }

    // 4. Lấy danh sách link các chương
    const chapterLinks: string[] = [];
    $(".list-chapter li a").each((i, el) => {
        const link = $(el).attr("href");
        if (link) chapterLinks.push(link);
    });
    
    console.log(`🔍 Tìm thấy ${chapterLinks.length} chương. Bắt đầu tải nội dung...`);

    // 5. Tính toán chương tiếp theo cần insert
    const existingChapters = await db.query.chapters.findMany({
        where: eq(schema.chapters.storyId, storyRecord.id)
    });
    const nextChapterNum = existingChapters.length + 1;

    // 6. Loop qua từng link chương để scrape nội dung (Giới hạn 10 chương test)
    // Thay `.slice(0, 10)` thành `.slice(nextChapterNum - 1)` để scrape tiếp
    const targetChapters = chapterLinks.slice(0, 10); 

    for (let i = 0; i < targetChapters.length; i++) {
        const chapterUrl = targetChapters[i];
        const chapterNumber = nextChapterNum + i;

        console.log(`⏳ Đang cào chương ${chapterNumber}: ${chapterUrl}`);
        
        try {
            const { data: chapHtml } = await axios.get(chapterUrl);
            const $chap = cheerio.load(chapHtml);
            
            const chapTitle = $chap(".chapter-title").text().trim() || `Chương ${chapterNumber}`;
            
            // Lấy nội dung chữ và giữ nguyên ngắt dòng
            const chapBody = $chap(".chapter-c").html();
            // Lọc ra raw text đơn giản phân cách bởi \n
            const cleanContent = chapBody ? $chap(".chapter-c").text().replace(/\n\s*\n/g, '\n\n').trim() : "";

            if (!cleanContent) {
                 console.log(`⚠️ Chương ${chapterNumber} trống nội dung, bỏ qua.`);
                 continue;
            }

            // Insert Database
            await db.insert(schema.chapters).values({
                storyId: storyRecord.id,
                chapterNumber: chapterNumber,
                title: chapTitle,
                content: cleanContent,
                isPublished: 1, // Xuất bản luôn
                wordCount: cleanContent.split(/\s+/).length
            });

            console.log(`✅ Đã lưu chương ${chapterNumber}. (Nghỉ 1s tránh bị ban IP)`);
            // Chống spam server nguồn
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (err: any) {
            console.error(`❌ Lỗi tải chương ${chapterNumber}:`, err.message);
        }
    }

    console.log("🎉 Hoàn tất cào dữ liệu!");

  } catch (error: any) {
    console.error("❌ Lỗi Scraper:", error.message);
  }
}

// Bỏ comment dòng dưới để chạy
// scrapeNovelData().catch(console.error);
