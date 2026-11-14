# NOTES — holiday-check

内部構造の索引。揮発・鮮度非保証。仕様は VISION.md を見る。

## 内閣府 祝日 CSV（2026-11-14 時点で確認）

- URL: `https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv`
- Shift_JIS / CRLF / ヘッダ 1 行（`国民の祝日・休日月日,国民の祝日・休日名称`）
- 日付形式は `YYYY/M/D`（ゼロ埋めなし）
- 収録: 1955/1/1 〜 2027/11/23（年単位では 1955〜2027 年）
- 振替休日・国民の休日はどちらも名称「休日」。特殊名称として `休日（祝日扱い）`、`体育の日（スポーツの日）` がある（2019 年）

## ファイル構成

- `src/` — 公開ディレクトリ（デプロイ対象）。`index.html` / `style.css` / `app.js` / `core.js` / `holidays.json`
- `scripts/convert-holidays.mjs` — CSV → `src/holidays.json`（`convertCsvText` を export してテストから使う）
- `test/` — `node --test`。TZ 非依存のテストは子プロセスを複数の `TZ` で起動して出力を比較する
- `Makefile` — `test` / `holidays` / `serve` / `deploy` / `check-live`

## core.js の状態

- `dayInfo().status`: `holiday` / `unknown`（範囲外かつ休みでない）/ `workday`。`outOfRange` は status と独立したフラグ（範囲外の日曜は `holiday` + `outOfRange`）
- 使用期限は `expiryCheck()`。4 日分の `dayInfo` を持ち、`holidays` に休みの日だけを入れる

## app.js

- 交付日を手で変えていなければ、日付が変わったとき（60 秒ごと・タブ復帰時に確認）今日に追従する
- 交付日の入力欄は透明にして自前表示（`yyyy/mm/dd(曜)`）に重ねている。クリックで `showPicker()`。一覧の日付も `yyyy/mm/dd(曜)`、使用期限の休みの列挙だけ `m/d(曜)`
- `index.html` に CSP（`default-src 'self'`）を入れ、外部リクエストをブラウザ側でも遮断する。favicon は `data:,` で要求させない

## VM（2026-11-14 時点、読み取りで確認）

- Caddy v2.11 / `/etc/caddy/Caddyfile` で `lab.kwrkb.net` を `root * /var/www/lab` + `file_server`
- `/var/www/lab` は root:root 755。サブディレクトリ `holiday-check/` を ubuntu 所有で作れば以後 sudo なしで rsync できる
- トップページ `/var/www/lab/index.html` はどのリポジトリでも管理していない手書きファイル（root:root 644）。`holiday-check/` へのリンクを含む。変更は VM のホームに置いてから `sudo install -m 644 -o root -g root <file> /var/www/lab/index.html` で差し替える（sudo のため事前確認が必要）
