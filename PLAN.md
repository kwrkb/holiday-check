# PLAN — holiday-check

フェーズ境界と現在地のみ。手順分解はセッション内で管理する。

## 現在地: v1 公開済み（以後は年 1 回の祝日データ更新）

## Phase 0: ドキュメント準備（完了）
- [x] VISION.md / PLAN.md / LESSONS.md / NOTES.md / CLAUDE.md の叩き台
- [x] VISION.md のユーザー承認

## Phase 1: 祝日データと判定ロジック（完了）
- [x] 内閣府 CSV → `src/holidays.json` の変換スクリプトと README の更新手順
- [x] `src/core.js` と `node --test` のテスト（受け入れ条件のケースがすべて通る。`TZ=UTC` でも同結果）

## Phase 2: ページ（完了）
- [x] 開いた瞬間に当日交付の使用期限と 10 行の N 日後が表示される
- [x] 警告行だけが目立ち理由が出る。スマートフォンで読める。外部リクエストなし

## Phase 3: 公開（完了）
- [x] VM の Caddy 設定を読んで配置先を決定（確認を取る）
- [x] `make deploy` で公開し、`/holiday-check/` と既存トップページの両方が表示される
- [x] GitHub リポジトリ公開
