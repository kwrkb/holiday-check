// 判定ロジック（DOM 非依存の純粋関数）。
// 日付はすべて JST の年月日を表す "YYYY-MM-DD" 文字列で扱う。
// 内部計算は Date.UTC による通日（1970-01-01 からの日数）で行い、
// 実行環境のローカルタイムゾーンに依存する Date メソッドは使わない。

export const OFFSETS = Object.freeze([7, 14, 21, 28, 30, 56, 60, 63, 84, 90]);
export const EXPIRY_DAYS = 4; // 交付日を含めて 4 日以内
export const WEEKDAYS_JA = Object.freeze(["日", "月", "火", "水", "木", "金", "土"]);

export const REASON_YEAR_END = "年末年始";
export const REASON_SUNDAY = "日曜";

const DAY_MS = 86400000;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "YYYY-MM-DD" を通日に変換する。不正な日付は例外。 */
export function toDayNumber(iso) {
  const m = typeof iso === "string" ? ISO_RE.exec(iso) : null;
  if (!m) throw new RangeError(`日付の形式が不正です: ${iso}`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const n = Date.UTC(y, mo - 1, d) / DAY_MS;
  if (fromDayNumber(n) !== iso) throw new RangeError(`存在しない日付です: ${iso}`);
  return n;
}

/** 通日を "YYYY-MM-DD" に変換する。 */
export function fromDayNumber(n) {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

export function isValidDate(iso) {
  try {
    toDayNumber(iso);
    return true;
  } catch {
    return false;
  }
}

export function addDays(iso, days) {
  return fromDayNumber(toDayNumber(iso) + days);
}

/** 曜日（0 = 日曜 〜 6 = 土曜） */
export function weekday(iso) {
  return new Date(toDayNumber(iso) * DAY_MS).getUTCDay();
}

/** 年末年始（12/29〜1/3）か */
export function isYearEnd(iso) {
  toDayNumber(iso);
  const mo = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  return (mo === 12 && d >= 29) || (mo === 1 && d <= 3);
}

/** 現在時刻（Date）から JST の今日を "YYYY-MM-DD" で返す。 */
export function todayJST(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** 祝日データの収録範囲内か */
export function inRange(iso, data) {
  const n = toDayNumber(iso);
  return n >= toDayNumber(data.range.start) && n <= toDayNumber(data.range.end);
}

/**
 * 1 日分の判定。
 * status: "holiday"（休み）/ "unknown"（休みではないが祝日データ範囲外）/ "workday"
 * 休みの理由は「祝日名 → 年末年始 → 日曜」の順。範囲外でも年末年始・日曜は判定する。
 */
export function dayInfo(iso, data) {
  const wd = weekday(iso);
  const outOfRange = !inRange(iso, data);
  const reasons = [];
  const holidayName = outOfRange ? undefined : data.holidays[iso];
  if (holidayName) reasons.push(holidayName);
  if (isYearEnd(iso)) reasons.push(REASON_YEAR_END);
  if (wd === 0) reasons.push(REASON_SUNDAY);
  const status = reasons.length > 0 ? "holiday" : outOfRange ? "unknown" : "workday";
  return { date: iso, weekday: wd, weekdayJa: WEEKDAYS_JA[wd], reasons, outOfRange, status };
}

/**
 * 処方箋の使用期限。期限 = 交付日 + 3 日。
 * 交付日〜期限の両端を含む 4 日間の休みを数える。
 */
export function expiryCheck(issueDate, data) {
  const days = [];
  for (let i = 0; i < EXPIRY_DAYS; i++) days.push(dayInfo(addDays(issueDate, i), data));
  const holidays = days.filter((d) => d.status === "holiday");
  const outOfRange = days.some((d) => d.outOfRange);
  const status = holidays.length > 0 ? "holiday" : outOfRange ? "unknown" : "workday";
  const expiry = days[days.length - 1];
  return {
    issueDate,
    date: expiry.date,
    weekday: expiry.weekday,
    weekdayJa: expiry.weekdayJa,
    days,
    holidays,
    outOfRange,
    status,
  };
}

/** 交付日 + N 日の判定 */
export function offsetCheck(issueDate, n, data) {
  return { n, ...dayInfo(addDays(issueDate, n), data) };
}

/** 画面に出す一覧一式 */
export function buildReport(issueDate, data, offsets = OFFSETS) {
  toDayNumber(issueDate);
  return {
    issueDate,
    expiry: expiryCheck(issueDate, data),
    offsets: offsets.map((n) => offsetCheck(issueDate, n, data)),
  };
}
