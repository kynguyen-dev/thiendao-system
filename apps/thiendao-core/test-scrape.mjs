import axios from "axios";
import * as cheerio from "cheerio";

async function testScrape() {
    const url = "http://vietnamthuquan.eu/(X(1)S(5zdfjt45obk3w245kaityq55))/truyen/truyen.aspx?tid=2qtqv3m3237nnn1n0nnn4n31n343tq83a3q3m3237nvn#phandau";
    
    try {
        const { data: html } = await axios.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });
        
        const $ = cheerio.load(html);
        
        console.log("--- TITLE TAG ---");
        console.log($("title").text().trim());
        
        console.log("\n--- H1/H2 TAGS ---");
        console.log("H1:", $("h1").text().trim());
        console.log("H2:", $("h2").text().text().trim());
        
        console.log("\n--- TRYING TO FIND STORY CONTENT ---");
        
        // Vietnamthuquan usually stores content in a specific table/div
        // Let's find any element with a lot of text.
        let maxTextLen = 0;
        let bestSelector = "";
        let bestText = "";
        
        $("div, td").each((i, el) => {
            const text = $(el).text().trim();
            if (text.length > maxTextLen) {
                // Ensure it's not the body or html itself
                if (el.tagName !== 'body' && el.tagName !== 'html') {
                    maxTextLen = text.length;
                    bestSelector = el.tagName + ($(el).attr("class") ? "." + $(el).attr("class").split(" ").join(".") : "") + ($(el).attr("id") ? "#" + $(el).attr("id") : "");
                    bestText = text;
                }
            }
        });
        
        console.log(`Best Content Element: ${bestSelector} (Length: ${maxTextLen})`);
        console.log("Preview (First 200 chars):", bestText.substring(0, 200).replace(/\n/g, " "));
        
        console.log("\n--- EXTRACTING ALL NOVEL PARAGRAPHS FROM BEST MATCH ---");
        // Often content is separated by <br/> or <p> chunks
        const paragraphs: string[] = [];
        $(bestSelector).contents().each((i, el) => {
            if (el.type === 'text') {
                const text = $(el).text().trim();
                if (text.length > 20) paragraphs.push(text);
            }
        });
        
        if (paragraphs.length > 0) {
             console.log(`Found ${paragraphs.length} paragraphs. First two:`);
             console.log(paragraphs[0]);
             console.log(paragraphs[1]);
        } else {
             console.log("No text nodes directly inside. Full html of bestmatch:");
             console.log($(bestSelector).html()?.substring(0, 500));
        }
        
    } catch (err) {
        console.error("Lỗi:", err);
    }
}

testScrape();
