#!/usr/bin/env node
// 内閣府「国民の祝日」CSV（Shift_JIS）を src/holidays.json に変換する。
// 使い方: node scripts/convert-holidays.mjs <syukujitsu.csv> [出力先]
// 依存なし（Node 標準の TextDecoder を使用）。

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const SOURCE_URL = "https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv";

const DAY_MS = 86400000;

function pad2(n) {
  return String(n).padStart(2, "0");
}

function dayNumber(y, m, d) {
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

function isoFromDayNumber(n) {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

/**
 * CSV テキスト（デコード済み）を祝日データに変換する。
 * 名称「休日」は、前日と翌日がともに祝日なら「国民の休日」、それ以外は「振替休日」とする（VISION.md）。
 */
export function convertCsvText(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== "");
  if (lines.length < 2) throw new Error("CSV にデータ行がありません");

  const byDay = new Map();
  for (const [i, line] of lines.slice(1).entries()) {
    const cols = line.split(",");
    if (cols.length < 2) throw new Error(`${i + 2} 行目: 列が足りません: ${line}`);
    const m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(cols[0].trim());
    if (!m) throw new Error(`${i + 2} 行目: 日付の形式が不正です: ${cols[0]}`);
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const n = dayNumber(y, mo, d);
    if (isoFromDayNumber(n) !== `${y}-${pad2(mo)}-${pad2(d)}`) {
      throw new Error(`${i + 2} 行目: 存在しない日付です: ${cols[0]}`);
    }
    const name = cols[1].trim();
    if (name === "") throw new Error(`${i + 2} 行目: 名称が空です`);
    if (byDay.has(n)) throw new Error(`${i + 2} 行目: 日付が重複しています: ${cols[0]}`);
    byDay.set(n, name);
  }

  const days = [...byDay.keys()].sort((a, b) => a - b);
  const holidays = {};
  for (const n of days) {
    let name = byDay.get(n);
    if (name === "休日") {
      name = byDay.has(n - 1) && byDay.has(n + 1) ? "国民の休日" : "振替休日";
    }
    holidays[isoFromDayNumber(n)] = name;
  }

  const firstYear = isoFromDayNumber(days[0]).slice(0, 4);
  const lastYear = isoFromDayNumber(days[days.length - 1]).slice(0, 4);
  return {
    source: SOURCE_URL,
    range: { start: `${firstYear}-01-01`, end: `${lastYear}-12-31` },
    holidays,
  };
}

export function convertCsvBytes(bytes) {
  const text = new TextDecoder("shift_jis", { fatal: true }).decode(bytes);
  return convertCsvText(text);
}

function main(argv) {
  const [input, output] = argv;
  if (!input) {
    console.error("使い方: node scripts/convert-holidays.mjs <syukujitsu.csv> [出力先]");
    process.exit(2);
  }
  const here = path.dirname(fileURLToPath(import.meta.url));
  const out = output ?? path.join(here, "..", "src", "holidays.json");
  const data = convertCsvBytes(readFileSync(input));
  writeFileSync(out, JSON.stringify(data, null, 1) + "\n");
  const count = Object.keys(data.holidays).length;
  console.log(`${count} 件を書き出しました（収録範囲 ${data.range.start} 〜 ${data.range.end}）: ${path.relative(process.cwd(), out)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
