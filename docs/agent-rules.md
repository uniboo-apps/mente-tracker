# 定期メンテ管理アプリ (mente-tracker)

本文中のコードパスは repo ルート基準（Markdownリンクは文書位置基準）。
Notion「定期メンテ」DB と連動する、家のモノの定期お手入れ管理ダッシュボード。

## 何のアプリか

- 最終メンテ日 ＋ 周期日数 から「次回予定日／残り日数」を自動計算し、期限の近い順に色分け表示（🔴超過 / 🟡7日以内 / 🟢余裕 / ⚪未設定）。
- 「✅ 今日やった」ボタンで最終メンテ日を今日に書き戻し（Notionを開かず完結）。
- ✏️編集・＋追加で項目を管理。取説リンク・メモ（手順）もカードに表示。
- スマホ縦・PWA前提のUI。

## 構成

- `index.html` … ダッシュボード本体（バニラJS、依存なし）。
- `functions/api/list.js` … Notion DBクエリ（POST）。
- `functions/api/update.js` … ページ更新（POST）。「今日やった」もこれ。
- `functions/api/create.js` … 新規項目追加（POST）。
- Cloudflare Pages（静的）＋ Pages Functions が Notion トークンを隠して中継。

## Notion DB

- DB id: `3234b6f3-2895-80b2-8880-cd22acf84b21`（統合「定期メンテ専用」トークン。値はDPAPI秘密保管庫の `notion_token_mente_tracker` を参照）
- プロパティ: 名前(title) / 最終メンテ日(date) / 周期日数(number) / メンテ周期(rich_text・旧自由文) / 取説_お手入れ(url) / メモ(rich_text)
- 日数計算は **周期日数(number)** を使う。旧「メンテ周期」自由文は参考表示のみ。

## 環境変数（Cloudflare Pages の設定で登録）

- `NOTION_TOKEN`（必須）… Notion統合トークン。
- `APP_PASSCODE`（必須）… Cloudflare Pages の暗号化Secret。未設定・空・空白のみ・文字列以外の場合は API 全体が `503` で拒否され、合言葉の未送信・不一致は `401` で拒否される。
  - ローカル開発も認証を省略しない。`.dev.vars` または `wrangler pages dev --binding APP_PASSCODE=<テスト用合言葉>` で設定する。

## ローカル開発・テスト

```powershell
# .dev.vars に NOTION_TOKEN と APP_PASSCODE を設定（.gitignore 済み）。認証設定がない場合は API が fail closed する。
cd c:\work\Claude\mente-tracker
wrangler pages dev . --port 8788 --compatibility-date 2024-01-01
# → http://127.0.0.1:8788
```

`file://` ではなく必ず Functions込みの wrangler で起動すること（/api/* が動かないため）。

## デプロイ

Cloudflare Pages（GitHub連携 or `wrangler pages deploy .`）。デプロイ後、Pages の
Settings → Environment variables に `NOTION_TOKEN`（と必要なら `APP_PASSCODE`）を登録する。
