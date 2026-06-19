# 定期メンテ管理アプリ (mente-tracker)

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

- DB id: `3234b6f3-2895-80b2-8880-cd22acf84b21`（統合「ログ書き込み」トークン = [[secrets-access]]）
- プロパティ: 名前(title) / 最終メンテ日(date) / 周期日数(number) / メンテ周期(rich_text・旧自由文) / 取説_お手入れ(url) / メモ(rich_text)
- 日数計算は **周期日数(number)** を使う。旧「メンテ周期」自由文は参考表示のみ。

## 環境変数（Cloudflare Pages の設定で登録）

- `NOTION_TOKEN`（必須）… Notion統合トークン。
- `APP_PASSCODE`（任意）… 設定すると合言葉ガードが有効。未設定なら誰でもアクセス可。
  - ローカル開発(`.dev.vars`)では未設定＝認証なし。

## ローカル開発・テスト

```powershell
# .dev.vars に NOTION_TOKEN を入れて（.gitignore 済み）
cd c:\work\Claude\mente-tracker
wrangler pages dev . --port 8788 --compatibility-date 2024-01-01
# → http://127.0.0.1:8788
```

`file://` ではなく必ず Functions込みの wrangler で起動すること（/api/* が動かないため）。

## デプロイ

Cloudflare Pages（GitHub連携 or `wrangler pages deploy .`）。デプロイ後、Pages の
Settings → Environment variables に `NOTION_TOKEN`（と必要なら `APP_PASSCODE`）を登録する。
コミットメッセージは ASCII（英数字）で書く（Cloudflare Pages デプロイ失敗回避）。
