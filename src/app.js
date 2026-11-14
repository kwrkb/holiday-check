// 表示用。判定ロジックは core.js にある。
import { buildReport, isValidDate, todayJST, WEEKDAYS_JA, weekday } from "./core.js";

const $ = (id) => document.getElementById(id);
const input = $("issue-date");
const display = $("issue-display");
const resetButton = $("reset-today");

let data = null;
let followToday = true; // 交付日を手で変えていなければ、日付が変わったら追従する
let currentToday = todayJST();

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** "2027-01-09" → "2027/01/09(土)"（ブラウザの言語設定によらず年/月/日で表示する） */
function fullDate(iso, wd) {
  return `${iso.replaceAll("-", "/")}(${WEEKDAYS_JA[wd]})`;
}

/** "2027-01-09" → "1/9(土)"（使用期限の期間内の休みの列挙用） */
function shortDate(iso, wd) {
  const [, m, d] = iso.split("-").map(Number);
  return `${m}/${d}(${WEEKDAYS_JA[wd]})`;
}

function rowNode(status) {
  const li = el("li", "row");
  if (status === "holiday") li.classList.add("is-holiday");
  if (status === "unknown") li.classList.add("is-unknown");
  return li;
}

const OUT_OF_RANGE = "祝日データ範囲外";

function renderExpiry(e) {
  const li = rowNode(e.status);
  li.append(el("span", "label", "期限"));
  li.append(el("span", "date", `${fullDate(e.date, e.weekday)}まで`));
  if (e.holidays.length > 0) {
    const reason = el("span", "reason", "期間内に休み: ");
    e.holidays.forEach((d, i) => {
      if (i > 0) reason.append("、");
      reason.append(el("span", "item", `${shortDate(d.date, d.weekday)} ${d.reasons.join("・")}`));
    });
    li.append(reason);
  }
  if (e.outOfRange) li.append(el("span", "reason out-of-range", `${OUT_OF_RANGE}を含む`));
  return li;
}

function renderOffset(o) {
  const li = rowNode(o.status);
  li.append(el("span", "label", `${o.n}日後`));
  li.append(el("span", "date", fullDate(o.date, o.weekday)));
  if (o.reasons.length > 0) li.append(el("span", "reason", `休み: ${o.reasons.join("・")}`));
  if (o.outOfRange) li.append(el("span", "reason out-of-range", OUT_OF_RANGE));
  return li;
}

function showMessage(text) {
  const m = $("message");
  m.textContent = text;
  m.hidden = !text;
}

function render() {
  const issue = input.value;
  const valid = isValidDate(issue);
  resetButton.hidden = issue === currentToday;
  display.textContent = valid ? fullDate(issue, weekday(issue)) : "日付を選択";
  $("issue-today").hidden = issue !== currentToday;
  if (!data) return;
  if (!valid) {
    $("expiry").replaceChildren();
    $("offsets").replaceChildren();
    showMessage("交付日を入力してください。");
    return;
  }
  showMessage("");
  const report = buildReport(issue, data);
  $("expiry").replaceChildren(renderExpiry(report.expiry));
  $("offsets").replaceChildren(...report.offsets.map(renderOffset));
}

function setToday() {
  currentToday = todayJST();
  input.value = currentToday;
  followToday = true;
  render();
}

function checkDateChange() {
  const t = todayJST();
  if (t === currentToday) return;
  currentToday = t;
  if (followToday) input.value = t;
  render();
}

async function init() {
  input.value = currentToday;
  render();
  input.addEventListener("input", () => {
    followToday = input.value === currentToday;
    render();
  });
  // 入力欄は透明にして自前の表示に重ねている。クリックでピッカーを開く
  input.addEventListener("click", () => {
    try {
      input.showPicker();
    } catch {
      // showPicker 非対応のブラウザでは、ネイティブの動作に任せる
    }
  });
  resetButton.addEventListener("click", setToday);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkDateChange();
  });
  setInterval(checkDateChange, 60 * 1000);

  try {
    const res = await fetch("./holidays.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    showMessage(`祝日データを読み込めませんでした（${err.message}）。判定できません。`);
    return;
  }
  const [sy] = data.range.start.split("-");
  const [ey] = data.range.end.split("-");
  $("data-range").textContent = ` 祝日データ収録: ${sy}〜${ey}年。`;
  render();
}

init();
