// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  📦 ADAPTER REGISTRY — Tự động nhận diện nguồn từ URL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import type { SourceAdapter } from "../types.js";
import { truyenFullAdapter } from "./truyenfull.js";
import { vntqAdapter } from "./vntq.js";
import { tangThuVienAdapter } from "./tangthuvien.js";
import { ssTruyenAdapter } from "./sstruyen.js";

/** Danh sách tất cả các adapter đã đăng ký */
const REGISTERED_ADAPTERS: SourceAdapter[] = [
  truyenFullAdapter,
  vntqAdapter,
  tangThuVienAdapter,
  ssTruyenAdapter,
];

/**
 * Tự động nhận diện adapter phù hợp từ URL.
 * @throws Error nếu không tìm thấy adapter phù hợp
 */
export function detectAdapter(url: string): SourceAdapter {
  const adapter = REGISTERED_ADAPTERS.find(a => a.urlPattern.test(url));
  if (!adapter) {
    const supportedSites = REGISTERED_ADAPTERS.map(a => a.name).join(", ");
    throw new Error(
      `❌ Không nhận diện được nguồn từ URL: ${url}\n` +
      `   Các nguồn được hỗ trợ: ${supportedSites}\n` +
      `   Hãy đảm bảo URL thuộc một trong các trang trên.`
    );
  }
  return adapter;
}

/** Lấy danh sách tên các nguồn được hỗ trợ */
export function getSupportedSources(): string[] {
  return REGISTERED_ADAPTERS.map(a => a.name);
}

/** Đăng ký thêm adapter mới (extensible) */
export function registerAdapter(adapter: SourceAdapter): void {
  REGISTERED_ADAPTERS.push(adapter);
}

export { REGISTERED_ADAPTERS };
