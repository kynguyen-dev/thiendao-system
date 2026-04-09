import { db, schema } from "./src/db/index.js";
import fs from "fs";

async function inspect() {
  const chapters = await db.query.chapters.findMany({ limit: 10, orderBy: [schema.chapters.createdAt] });
  let out = `Tìm thấy ${chapters.length} chương.\n`;
  
  if (chapters.length > 0) {
    const ch = chapters[0];
    out += `--- CHƯƠNG ĐẦU TIÊN ---\n`;
    out += `Title: ${ch.title}\n`;
    out += `Word count: ${ch.wordCount}\n`;
    out += `Content length: ${ch.content?.length || "UNDEFINED/NULL"}\n`;
    out += `First 100 chars content: ${String(ch.content).substring(0, 100)}\n`;
  }
  fs.writeFileSync("db.txt", out, "utf-8");
  process.exit(0);
}

inspect();
