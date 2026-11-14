# holiday-check

調剤薬局の窓口向けに、**処方箋の使用期限**と**投与日数の N 日後**に「休み」が入っていないかを知らせる静的 Web ページです。

公開先: https://lab.kwrkb.net/holiday-check/

- 交付日（初期値は日本時間の今日）を入れると、使用期限（交付日を含めて 4 日）と 7, 14, 21, 28, 30, 56, 60, 63, 84, 90 日後を一覧表示します
- 休みに当たる行だけが赤くなり、理由（「元日」「年末年始」「振替休日」「日曜」など）が出ます
- 休み = 国民の祝日・振替休日・国民の休日（内閣府の祝日 CSV）、年末年始（12/29〜1/3）、日曜。土曜と各店の定休日は対象外です
- 祝日データの収録範囲外の日付は「祝日データ範囲外」と黄色で表示します（平日扱いにしません）
- 外部へのリクエスト・アクセス解析はありません

**参考表示です。最終確認は各自で行ってください。**

## 構成

| パス | 内容 |
| --- | --- |
| `src/` | 公開ディレクトリ（デプロイ対象はここだけ） |
| `src/core.js` | 判定ロジック（DOM 非依存の純粋関数） |
| `src/app.js` | 表示 |
| `src/holidays.json` | 祝日データ（変換スクリプトで生成） |
| `scripts/convert-holidays.mjs` | 内閣府 CSV → `src/holidays.json` |
| `test/` | `node --test` |

依存パッケージはありません。Node.js は開発・テスト用のみです（v24 で動作確認）。

## 開発

```sh
make test    # TZ=UTC と TZ=Asia/Tokyo で node --test
make serve   # http://127.0.0.1:8000/ でローカル確認
```

ES modules と `fetch` を使うため、`index.html` をファイルとして直接開いても動きません。`make serve` などで HTTP 経由で開いてください。

## 祝日データの更新（年 1 回）

翌年の春分の日・秋分の日は前年 2 月に官報で公表されます。それ以降、内閣府の CSV に翌年分が追加されているのを確認したら次を行います。

```sh
mkdir -p /tmp/holiday-csv
curl -fL -o /tmp/holiday-csv/syukujitsu.csv https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv
make holidays CSV=/tmp/holiday-csv/syukujitsu.csv
git diff --stat src/holidays.json   # 追加された年を確認
make test
make deploy
```

- CSV は Shift_JIS です。変換スクリプトは Node 標準の `TextDecoder("shift_jis")` で読みます
- CSV では振替休日と国民の休日がどちらも「休日」という名称です。変換時に、前日と翌日がともに祝日なら「国民の休日」、それ以外は「振替休日」に分類します
- 収録範囲は「CSV の最初の年の 1/1 〜 最後の年の 12/31」です。この範囲外の日付はページ上で「祝日データ範囲外」になります

## デプロイ

```sh
make deploy
```

テストを実行してから、`src/` を `rsync` で SSH ホスト `oci-lab`（`~/.ssh/config` のエイリアス）の `/var/www/lab/holiday-check/` に転送し、公開 URL と既存トップページが 200 を返すことを確認します。VM 側の Caddy は `/var/www/lab` を `file_server` で配信しているため、設定変更は不要です。

## ライセンス

MIT
