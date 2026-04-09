import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";

async function run() {
    const url = "http://vietnamthuquan.eu/(X(1)S(5zdfjt45obk3w245kaityq55))/truyen/truyen.aspx?tid=2qtqv3m3237nnn1n0nnn4n31n343tq83a3q3m3237nvn#phandau";
    const { data: html } = await axios.get(url, {
        headers: { "User-Agent": "Mozilla/5.0" }
    });
    
    const $ = cheerio.load(html);
    
    // Attempt standard vietnamthuquan extraction
    const contentText = $("#body tr").text().trim();
    // VNTQ puts novel titles in the top bar typically, but might be hard to guess
    const title = $("title").text().trim();
    
    fs.writeFileSync("vntq_test.json", JSON.stringify({ title, partialHtml: html.substring(0, 1000) }, null, 2), "utf8");
    console.log("Done");
}
run();
