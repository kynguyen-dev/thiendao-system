import Groq from "groq-sdk";
import * as dotenv from "dotenv";
import { writeFileSync } from "fs";

dotenv.config();
const log = [];
const key = process.env.GROQ_API_KEY;
log.push("Key: " + (key ? key.slice(0, 12) + "..." : "NOT SET"));

const groq = new Groq({ apiKey: key });

try {
  log.push("Testing llama-3.1-8b-instant...");
  const r = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      { role: "system", content: "You are a helpful assistant. Reply in Vietnamese." },
      { role: "user", content: "Nói xin chào, 1 câu thôi." }
    ],
    max_tokens: 100,
  });
  log.push("✅ WORKS! Response: " + r.choices[0]?.message?.content);
  log.push("Usage: " + JSON.stringify(r.usage));
} catch (e) {
  log.push("❌ FAILED: " + e.message?.slice(0, 300));
}

writeFileSync("test-result.txt", log.join("\n"));
console.log("Done");
