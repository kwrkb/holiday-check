# CLAUDE.md — holiday-check

処方箋の使用期限と投与日数の N 日後に「休み」が入っていないかを知らせる静的 Web ページ。

## 優先順位

**VISION.md > PLAN.md > コード > NOTES.md**。矛盾を見つけたら自力で整合させず、止めて確認する。VISION.md の更新はユーザー承認必須。

## コマンド

- テスト: `make test`（= `node --test`。`TZ=UTC` と `TZ=Asia/Tokyo` の両方で実行）
- 祝日データ更新: `make holidays CSV=<path>`（手順は README）
- デプロイ: `make deploy`（`src/` だけを `ssh oci-lab` へ rsync）

## 実装上の約束

- 素の HTML / CSS / JS。依存・ビルドツール・外部 CDN・外部リクエストを追加しない
- 判定ロジックは `src/core.js` の純粋関数。DOM に触れない
- 日付は `"YYYY-MM-DD"` の JST 年月日として扱う。`new Date("YYYY-MM-DD")` やローカル TZ 依存の `Date` メソッドを使わない
- アセット参照は相対パス

## VM（`ssh oci-lab`）

- VM 全体の管理は別リポジトリ `kwrkb/lab-kwrkb-net`。このリポジトリから触るのは `/var/www/lab/holiday-check/` だけ（トップページと Caddy 設定はそちらで直す）
- してはいけない: sshd・ファイアウォール・OCI セキュリティリストの変更、既存 Caddy サイト設定の書き換え、パッケージ削除、再起動
- `sudo` を使う操作は実行前にコマンドを提示して確認を取る

## 公開リポジトリ

勤務先・店舗を特定できる情報、IP アドレス、シークレット、ローカルの絶対パスをコミットしない。
