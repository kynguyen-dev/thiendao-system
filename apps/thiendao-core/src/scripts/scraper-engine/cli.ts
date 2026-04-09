#!/usr/bin/env node
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  🐉 THIÊN ĐẠO SCRAPER — CLI ENTRY POINT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
//  Cách sử dụng:
//  ─────────────
//  npx tsx src/scripts/scraper-engine/cli.ts <URL> [options]
//
//  Hoặc qua npm script:
//  npm run scrape -- <URL> [options]
//
//  Ví dụ:
//  npm run scrape -- "https://truyenfull.vn/tien-nghich/" --max 50 --format txt
//  npm run scrape -- "http://vietnamthuquan.eu/..." --delay 3000 --db
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import path from "path";
import { runScraper, getSupportedSources } from "./engine.js";
import type { ScraperConfig } from "./types.js";

// ─── Parse CLI Arguments ────────────────────────────────────

function parseArgs(args: string[]): Partial<ScraperConfig> {
  const config: Partial<ScraperConfig> = {};

  // Argument đầu tiên không có "--" prefix = URL
  const positional = args.filter(a => !a.startsWith("--"));
  if (positional.length > 0) {
    config.tocUrl = positional[0];
  }

  // Parse named arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    const next = args[i + 1];

    switch (arg) {
      case "--url":
        config.tocUrl = next;
        i++;
        break;
      case "--output":
      case "--out":
      case "-o":
        config.outputDir = path.resolve(next || "scraped_novels");
        i++;
        break;
      case "--max":
      case "-m":
        config.maxChapters = parseInt(next || "0");
        i++;
        break;
      case "--start":
      case "-s":
        config.startChapter = parseInt(next || "1");
        i++;
        break;
      case "--delay":
      case "-d":
        config.delayMs = parseInt(next || "2000");
        i++;
        break;
      case "--format":
      case "-f":
        config.outputFormat = (next as "txt" | "json" | "both") || "txt";
        i++;
        break;
      case "--db":
        config.saveToDb = true;
        break;
      case "--no-file":
        config.saveToFile = false;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
    }
  }

  return config;
}

function printHelp(): void {
  const sources = getSupportedSources().join(", ");
  
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           🐉 THIÊN ĐẠO SCRAPER ENGINE v2.0                ║
║              Công cụ cào truyện tự động                     ║
╚══════════════════════════════════════════════════════════════╝

  CÚ PHÁP:
    npm run scrape -- <URL> [tùy chọn]
    npx tsx src/scripts/scraper-engine/cli.ts <URL> [tùy chọn]

  TÙY CHỌN:
    --url <url>       URL mục lục truyện
    --output, -o      Thư mục lưu output (mặc định: ./scraped_novels)
    --max, -m         Số chương tối đa cần cào (0 = tất cả)
    --start, -s       Bắt đầu từ chương nào (mặc định: 1)
    --delay, -d       Thời gian nghỉ giữa mỗi request (ms, mặc định: 2000)
    --format, -f      Định dạng output: txt, json, both (mặc định: txt)
    --db              Lưu vào database PostgreSQL
    --no-file         Không lưu ra file (chỉ lưu DB)
    --help, -h        Hiển thị trợ giúp

  NGUỒN ĐƯỢC HỖ TRỢ:
    ${sources}

  VÍ DỤ:
    # Cào 10 chương đầu từ TruyenFull, lưu file .txt
    npm run scrape -- "https://truyenfull.vn/tien-nghich/" --max 10

    # Cào toàn bộ từ VNTQ, lưu cả file lẫn DB
    npm run scrape -- "http://vietnamthuquan.eu/..." --db --format both

    # Resume cào tiếp từ chương 50
    npm run scrape -- "https://truyenfull.vn/tien-nghich/" --start 50

    # Chỉ lưu DB, không lưu file
    npm run scrape -- "https://truyenfull.vn/tien-nghich/" --db --no-file

  LƯU Ý:
    • Engine tự động nhận diện nguồn từ URL
    • Nếu bị dừng giữa chừng, chạy lại lệnh để auto-resume
    • File progress được lưu tại: <output>/<tên_truyện>/_progress.json
    • Log chi tiết tại: <output>/<tên_truyện>/_scrape.log
`);
}

// ─── Main ────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  const config = parseArgs(args);

  if (!config.tocUrl) {
    console.error("❌ Thiếu URL! Sử dụng: npm run scrape -- <URL>");
    console.error("   Gõ --help để xem hướng dẫn chi tiết.");
    process.exit(1);
  }

  try {
    await runScraper(config);
  } catch (err: any) {
    console.error(`\n❌ LỖI NGHIÊM TRỌNG: ${err.message}\n`);
    process.exit(1);
  }

  process.exit(0);
}

main();
