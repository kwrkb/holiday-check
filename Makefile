DEPLOY_HOST ?= oci-lab
DEPLOY_DIR  ?= /var/www/lab/holiday-check
PUBLIC_URL  ?= https://lab.kwrkb.net/holiday-check/
TOP_URL     ?= https://lab.kwrkb.net/

.PHONY: test holidays serve deploy check-live

## テスト（実行環境の TZ に依存しないことを 2 つの TZ で確認）
test:
	TZ=UTC node --test
	TZ=Asia/Tokyo node --test

## 祝日データ更新: make holidays CSV=path/to/syukujitsu.csv
holidays:
	@test -n "$(CSV)" || { echo "CSV=<syukujitsu.csv のパス> を指定してください"; exit 2; }
	node scripts/convert-holidays.mjs "$(CSV)"

## ローカル確認: http://127.0.0.1:8000/
serve:
	python3 -m http.server 8000 --bind 127.0.0.1 --directory src

## 公開: src/ だけを転送する
deploy: test
	rsync -rlt --delete --chmod=D755,F644 --itemize-changes src/ $(DEPLOY_HOST):$(DEPLOY_DIR)/
	$(MAKE) check-live

## 公開 URL と既存トップページの応答確認
check-live:
	@for u in $(PUBLIC_URL) $(PUBLIC_URL)holidays.json $(TOP_URL); do \
	  code=$$(curl -s -o /dev/null -w '%{http_code}' "$$u"); \
	  echo "$$code $$u"; test "$$code" = 200 || exit 1; \
	done
