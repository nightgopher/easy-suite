/** 日期统一展示为 ISO 形式（2026-11-06）；pubDate 是日历日期而非时刻，按 UTC 取值避免时区偏移 */
export function formatDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
