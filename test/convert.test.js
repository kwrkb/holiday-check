import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { convertCsvText } from "../scripts/convert-holidays.mjs";

const header = "国民の祝日・休日月日,国民の祝日・休日名称";

test("日付をゼロ埋めし、収録範囲を年単位で求める", () => {
  const r = convertCsvText([header, "2026/1/1,元日", "2027/11/23,勤労感謝の日", ""].join("\r\n"));
  assert.deepEqual(r.range, { start: "2026-01-01", end: "2027-12-31" });
  assert.deepEqual(r.holidays, { "2026-01-01": "元日", "2027-11-23": "勤労感謝の日" });
});

test("「休日」を振替休日・国民の休日に分類する", () => {
  const r = convertCsvText(
    [
      header,
      "2026/5/3,憲法記念日",
      "2026/5/4,みどりの日",
      "2026/5/5,こどもの日",
      "2026/5/6,休日",
      "2026/9/21,敬老の日",
      "2026/9/22,休日",
      "2026/9/23,秋分の日",
      "2019/5/1,休日（祝日扱い）",
    ].join("\r\n"),
  );
  assert.equal(r.holidays["2026-05-06"], "振替休日");
  assert.equal(r.holidays["2026-09-22"], "国民の休日");
  assert.equal(r.holidays["2019-05-01"], "休日（祝日扱い）");
});

test("不正な行は例外にする", () => {
  assert.throws(() => convertCsvText([header, "2026-01-01,元日"].join("\n")));
  assert.throws(() => convertCsvText([header, "2026/2/30,X"].join("\n")));
  assert.throws(() => convertCsvText([header, "2026/1/1,元日", "2026/1/1,元日"].join("\n")));
  assert.throws(() => convertCsvText(header));
});

test("同梱の holidays.json に「休日」が残っていない", () => {
  const data = JSON.parse(readFileSync(new URL("../src/holidays.json", import.meta.url), "utf8"));
  assert.ok(!Object.values(data.holidays).includes("休日"));
  assert.match(data.range.start, /^\d{4}-01-01$/);
  assert.match(data.range.end, /^\d{4}-12-31$/);
});
