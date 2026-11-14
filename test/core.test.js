import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  OFFSETS,
  addDays,
  buildReport,
  dayInfo,
  expiryCheck,
  isValidDate,
  isYearEnd,
  todayJST,
  weekday,
} from "../src/core.js";

const holidaysPath = fileURLToPath(new URL("../src/holidays.json", import.meta.url));
const data = JSON.parse(readFileSync(holidaysPath, "utf8"));

describe("使用期限", () => {
  test("期限 = 交付日 + 3 日、期間内の年末年始を含む（2026-12-28 交付）", () => {
    const e = expiryCheck("2026-12-28", data);
    assert.equal(e.date, "2026-12-31");
    assert.equal(e.weekdayJa, "木");
    assert.equal(e.status, "holiday");
    assert.deepEqual(
      e.holidays.map((d) => [d.date, d.reasons]),
      [
        ["2026-12-29", ["年末年始"]],
        ["2026-12-30", ["年末年始"]],
        ["2026-12-31", ["年末年始"]],
      ],
    );
  });

  test("期間は交付日当日を含む（日曜交付は交付日自体が休みとして数えられる）", () => {
    const e = expiryCheck("2026-11-15", data); // 日曜
    assert.equal(e.date, "2026-11-18");
    assert.deepEqual(e.holidays.map((d) => d.date), ["2026-11-15"]);
  });

  test("休みを含まない期間は workday", () => {
    const e = expiryCheck("2026-11-16", data); // 月〜木
    assert.equal(e.date, "2026-11-19");
    assert.equal(e.status, "workday");
    assert.deepEqual(e.holidays, []);
  });
});

describe("年末年始の境界", () => {
  test("12/28 と 1/4 は年末年始ではない", () => {
    assert.equal(isYearEnd("2026-12-28"), false);
    assert.equal(isYearEnd("2027-01-04"), false);
    assert.equal(dayInfo("2026-12-28", data).status, "workday"); // 月曜
    assert.equal(dayInfo("2027-01-04", data).status, "workday"); // 月曜
  });

  test("12/29 と 1/3 は年末年始", () => {
    assert.equal(isYearEnd("2026-12-29"), true);
    assert.equal(isYearEnd("2027-01-03"), true);
    assert.deepEqual(dayInfo("2026-12-29", data).reasons, ["年末年始"]);
  });

  test("理由が重なる日はすべて並べる（祝日名 → 年末年始 → 日曜）", () => {
    assert.deepEqual(dayInfo("2027-01-01", data).reasons, ["元日", "年末年始"]);
    assert.deepEqual(dayInfo("2027-01-03", data).reasons, ["年末年始", "日曜"]);
    assert.deepEqual(dayInfo("2023-01-01", data).reasons, ["元日", "年末年始", "日曜"]);
  });
});

describe("祝日（CSV 準拠）", () => {
  test("振替休日", () => {
    assert.deepEqual(dayInfo("2026-05-06", data).reasons, ["振替休日"]); // 5/3 が日曜
    assert.deepEqual(dayInfo("2027-03-22", data).reasons, ["振替休日"]); // 春分の日 3/21 が日曜
  });

  test("国民の休日", () => {
    assert.deepEqual(dayInfo("2026-09-22", data).reasons, ["国民の休日"]); // 敬老の日と秋分の日の間
  });

  test("通常の祝日と日曜", () => {
    assert.deepEqual(dayInfo("2026-11-23", data).reasons, ["勤労感謝の日"]);
    assert.deepEqual(dayInfo("2026-11-22", data).reasons, ["日曜"]);
  });

  test("土曜は警告対象にしない", () => {
    const d = dayInfo("2026-11-21", data);
    assert.equal(weekday("2026-11-21"), 6);
    assert.equal(d.status, "workday");
  });
});

describe("日付計算", () => {
  test("年をまたぐ（11 月交付の 60・90 日後）", () => {
    assert.equal(addDays("2026-11-14", 60), "2027-01-13");
    assert.equal(addDays("2026-11-14", 90), "2027-02-12");
    assert.equal(addDays("2026-11-30", 60), "2027-01-29");
    assert.equal(addDays("2026-11-30", 90), "2027-02-28");
  });

  test("うるう年の 2/29 をまたぐ", () => {
    assert.equal(addDays("2024-02-01", 28), "2024-02-29");
    assert.equal(addDays("2024-02-28", 7), "2024-03-06");
    assert.equal(addDays("2023-12-01", 90), "2024-02-29");
    assert.equal(addDays("2027-02-28", 7), "2027-03-07"); // 平年
  });

  test("N 日後は 14 行、交付日 + N 日", () => {
    const r = buildReport("2026-11-14", data);
    assert.deepEqual(r.offsets.map((o) => o.n), [7, 14, 21, 28, 30, 35, 42, 49, 56, 60, 63, 70, 84, 90]);
    assert.deepEqual(OFFSETS, [7, 14, 21, 28, 30, 35, 42, 49, 56, 60, 63, 70, 84, 90]);
    assert.equal(r.offsets[0].date, "2026-11-21");
    assert.equal(r.offsets.at(-1).date, "2027-02-12");
  });

  test("不正な日付は拒否する", () => {
    assert.equal(isValidDate("2026-02-29"), false);
    assert.equal(isValidDate("2026-13-01"), false);
    assert.equal(isValidDate("2026-1-1"), false);
    assert.equal(isValidDate(""), false);
    assert.equal(isValidDate("2024-02-29"), true);
    assert.throws(() => buildReport("2026-02-30", data), RangeError);
  });
});

describe("祝日データの収録範囲外", () => {
  test("範囲外の平日は unknown（平日扱いにしない）", () => {
    const d = dayInfo("2028-01-11", data); // 火曜
    assert.equal(d.outOfRange, true);
    assert.equal(d.status, "unknown");
    assert.deepEqual(d.reasons, []);
    assert.equal(dayInfo("1954-12-28", data).status, "unknown");
  });

  test("範囲外でも年末年始・日曜は休みとして判定し、範囲外であることも併記する", () => {
    const d = dayInfo("2028-01-02", data); // 日曜・年末年始
    assert.equal(d.status, "holiday");
    assert.equal(d.outOfRange, true);
    assert.deepEqual(d.reasons, ["年末年始", "日曜"]);
  });

  test("N 日後が範囲外になる", () => {
    const r = buildReport("2027-11-01", data);
    const o90 = r.offsets.find((o) => o.n === 90);
    assert.equal(o90.date, "2028-01-30");
    assert.equal(o90.outOfRange, true);
    const o28 = r.offsets.find((o) => o.n === 28);
    assert.equal(o28.outOfRange, false);
  });

  test("使用期限の期間が範囲をまたぐ", () => {
    const e = expiryCheck("2027-12-30", data);
    assert.equal(e.date, "2028-01-02");
    assert.equal(e.outOfRange, true);
    assert.equal(e.status, "holiday");
    const w = expiryCheck("2028-03-06", data); // 月〜木、範囲外
    assert.equal(w.status, "unknown");
  });

  test("収録範囲の端", () => {
    assert.equal(dayInfo("2027-12-28", data).outOfRange, false);
    assert.equal(dayInfo("2027-12-31", data).outOfRange, false);
    assert.equal(dayInfo("2028-01-01", data).outOfRange, true);
    assert.equal(dayInfo("1955-01-01", data).outOfRange, false);
  });
});

describe("タイムゾーン", () => {
  test("todayJST は JST の日付を返す", () => {
    assert.equal(todayJST(new Date("2026-11-14T14:59:59Z")), "2026-11-14"); // JST 23:59:59
    assert.equal(todayJST(new Date("2026-11-14T15:00:00Z")), "2026-11-15"); // JST 00:00:00
    assert.equal(todayJST(new Date("2026-12-31T15:00:00Z")), "2027-01-01");
  });

  test("実行環境の TZ を変えても結果が変わらない", () => {
    const coreUrl = new URL("../src/core.js", import.meta.url).href;
    const script = `
      import { readFileSync } from "node:fs";
      const core = await import(${JSON.stringify(coreUrl)});
      const data = JSON.parse(readFileSync(${JSON.stringify(holidaysPath)}, "utf8"));
      const out = {
        today: [
          core.todayJST(new Date("2026-11-14T14:59:59Z")),
          core.todayJST(new Date("2026-11-14T15:00:00Z")),
        ],
        reports: ["2026-11-14", "2026-12-28", "2024-02-01", "2027-11-01", "2026-03-08"]
          .map((d) => core.buildReport(d, data)),
      };
      process.stdout.write(JSON.stringify(out));
    `;
    const run = (tz) =>
      execFileSync(process.execPath, ["--input-type=module", "-e", script], {
        env: { ...process.env, TZ: tz },
        encoding: "utf8",
      });
    const zones = ["UTC", "Asia/Tokyo", "America/Los_Angeles", "Pacific/Kiritimati", "Pacific/Pago_Pago"];
    const results = zones.map(run);
    for (const [i, r] of results.entries()) {
      assert.equal(r, results[0], `TZ=${zones[i]} で結果が異なる`);
    }
    assert.deepEqual(JSON.parse(results[0]).today, ["2026-11-14", "2026-11-15"]);
  });
});
