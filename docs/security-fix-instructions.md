# mente-tracker セキュリティ・品質改善 実装指示書

2026-07-11 のコードレビューで見つかった改善点の実装手順。上から順に実施する。
【必須1】【必須2】は必ず実施。【推奨】は続けて実施してよい。【任意】は今回スキップ可。

## 前提

- 対象リポジトリ: `C:\work\Claude\mente-tracker`
- 本番: https://mente-tracker.pages.dev （Cloudflare Pages、main への push で GitHub Actions が自動デプロイ）
- コミットメッセージは **ASCII（英数字）のみ**（非ASCIIだと Cloudflare Pages デプロイが失敗する）
- コード変更後は確認なしに git commit & push してよい（このリポジトリのルール）
- トークン・合言葉の値をチャット・ログ・コミットに出さないこと
- ⚠️ **この指示書（docs/）を単独で先に push しないこと**。現行の deploy.yml は
  リポジトリ全量を公開するため、指示書まで本番公開されてしまう。
  必ず【必須1】の deploy.yml 修正と同じコミット（または同じ push）に含めること

## 背景（何が問題か）

1. **開発ファイルの本番公開**: `deploy.yml` が `wrangler pages deploy .` でリポジトリ全体を
   デプロイしているため、`/CLAUDE.md` `/AGENTS.md` `/.github/workflows/deploy.yml` が
   本番 URL で誰でも閲覧できる（実測で HTTP 200 を確認済み）。CLAUDE.md には Notion DB ID・
   トークンの所在・ローカルパス等の内部情報が載っている。
   ※ `.assetsignore` は `wrangler pages deploy` では無視されるので使わない（既知の罠）。
2. **update.js の id 未検証**: `id` を Notion API の URL パスにそのまま連結しているため、
   `../databases/...` のようなパストラバーサルで別エンドポイントを叩ける。
3. その他: `url` フィールドのスキーム未検証（`javascript:` を保存すると href で実行される）、
   Notion API エラー詳細のクライアントへの素通し、guard()/json() の3ファイル重複。

---

## 【必須1】deploy.yml をアローリスト方式に変更（開発ファイル公開の是正）

`.github/workflows/deploy.yml` の deploy ステップを、「公開してよいファイルだけを
`_site/` にコピーしてから `_site` をデプロイする」方式に変更する。
（fund-tracker の deploy.yml と同じアローリスト方式。ブロックリスト（rm）方式は
新規ファイル追加時に漏れるので採用しない）

公開してよいファイルは以下だけ:

- `index.html`
- `manifest.json`
- `sw.js`
- `icon-192.png`
- `icon-512.png`
- `functions/` ディレクトリ（Pages Functions のソース。wrangler がワーカーにコンパイルするもので、静的配信はされない）

deploy ステップの run を次のように書き換える（プロジェクト作成・secret put の部分は現状維持）:

```yaml
      - name: Create project if missing & deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: 3441724797f692af21f432e8625165d9
          NAME: ${{ github.event.repository.name }}
          NOTION_TOKEN: ${{ secrets.NOTION_TOKEN }}
          APP_PASSCODE: ${{ secrets.APP_PASSCODE }}
        run: |
          if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
            echo "::warning::CLOUDFLARE_API_TOKEN not set - skipping deploy."
            exit 0
          fi
          npx -y wrangler@4 pages project create "$NAME" --production-branch=main || true
          # Allowlist deploy: only copy public assets. Add new public files here.
          mkdir -p _site
          cp index.html manifest.json sw.js icon-192.png icon-512.png _site/
          cp -r functions _site/functions
          npx -y wrangler@4 pages deploy _site --project-name="$NAME" --branch=main --commit-dirty=true
          if [ -n "$NOTION_TOKEN" ]; then
            printf '%s' "$NOTION_TOKEN" | npx -y wrangler@4 pages secret put NOTION_TOKEN --project-name="$NAME"
          fi
          if [ -n "$APP_PASSCODE" ]; then
            printf '%s' "$APP_PASSCODE" | npx -y wrangler@4 pages secret put APP_PASSCODE --project-name="$NAME"
          fi
```

コメントとして「wrangler pages deploy はディレクトリ全ファイルを公開する。
公開してよいファイルだけ _site/ に集めてデプロイする（2026-07-11 レビューで是正）。
新しい公開ファイルを追加したら cp の対象にも追加すること」の趣旨を YAML 内に残す。

この docs/ ディレクトリ（本指示書）はアローリストに含めないこと（公開しない）。

## 【必須2】update.js の id を UUID 形式チェック

`functions/api/update.js` で `id` の検証を追加する。`if (!id)` チェックの直後に:

```js
  if (!/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(id))
    return json({ error: "bad id" }, 400);
```

Notion のページ ID はハイフンあり/なし両方の表記があるため `-?` にしている。
これでパストラバーサル（`../` 等）と任意エンドポイントへの PATCH を遮断する。

## 【推奨1】url フィールドのスキーム検証

`functions/api/create.js` と `functions/api/update.js` の両方で、`url` を保存する前に
http/https 以外を拒否する:

```js
// create.js: if (body.url) props[...] の前に
// update.js: if ("url" in body) ブロック内、null でない場合に
if (body.url && !/^https?:\/\//i.test(body.url)) return json({ error: "bad url" }, 400);
```

これで `javascript:` URL の保存（ストアドXSS）を防ぐ。

## 【推奨2】Notion API エラー詳細をクライアントに返さない

3ファイル（list.js / create.js / update.js）の `if (!res.ok)` ブロックで、
`detail`（Notion のエラー本文）をレスポンスに含めず `console.log` に出すだけにする:

```js
  if (!res.ok) {
    console.log("notion error", res.status, await res.text());
    return json({ error: "notion", status: res.status }, 502);
  }
```

※ index.html 側は `data.detail || data.error || ...` を表示しているので、
detail が無くなっても「失敗: notion」と表示されるだけで動作は壊れない。

## 【推奨3】guard()/json() の共通化（_middleware 方式）

3ファイルに完全重複している `guard()` を `functions/api/_middleware.js` に一本化する:

```js
// functions/api/_middleware.js — /api/* 全体の合言葉ガード
export async function onRequest({ request, env, next }) {
  if (env.APP_PASSCODE) {
    const got = request.headers.get("x-app-pass") || "";
    if (got !== env.APP_PASSCODE) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }
  }
  return next();
}
```

その上で list.js / create.js / update.js から `guard()` 定義と
`const bad = await guard(request, env); if (bad) return bad;` を削除する。
`json()` ヘルパーは各ファイルに残してよい（小さいので無理に共通化しない）。

## 【任意】list.js のページネーション対応

現状 `page_size: 100` 固定で 101 件目以降が黙って消える。項目数が増える予定が
なければスキップ可。対応する場合は `has_more` / `next_cursor` でループして全件取得する。

---

## 動作確認（必須）

### 1. ローカル確認（push 前）

`.dev.vars` に NOTION_TOKEN がある前提で:

```powershell
cd C:\work\Claude\mente-tracker
# サーバー起動〜確認〜停止は1つのコマンド内で完結させる（AGENTS.md のルール参照）
```

wrangler pages dev で起動し、以下を確認:

- `POST http://127.0.0.1:8788/api/list` が items を返す（一覧が壊れていない）
- `POST /api/update` に `{"id":"../databases/xxx"}` を送ると 400 `bad id` が返る
- （推奨1実施時）`url: "javascript:alert(1)"` で update すると 400 `bad url` が返る
- （推奨3実施時）_middleware 経由でも API が正常動作する
  （ローカルは APP_PASSCODE 未設定＝認証なしで通ればOK）

ローカル確認で wrangler pages dev に渡すディレクトリは `.`（リポジトリ直下）のままでよい。
アローリストはデプロイ時のみの話。

### 2. 本番確認（push 後）

commit & push（メッセージ例: `fix: allowlist deploy, validate page id and url scheme`）。
push 後 2〜3 分待ってから:

```powershell
# 開発ファイルが消えたこと（404 になること）
curl.exe -s -o NUL -w "CLAUDE.md: %{http_code}`n" https://mente-tracker.pages.dev/CLAUDE.md
curl.exe -s -o NUL -w "AGENTS.md: %{http_code}`n" https://mente-tracker.pages.dev/AGENTS.md
curl.exe -s -o NUL -w "deploy.yml: %{http_code}`n" https://mente-tracker.pages.dev/.github/workflows/deploy.yml
curl.exe -s -o NUL -w "docs: %{http_code}`n" https://mente-tracker.pages.dev/docs/security-fix-instructions.md

# アプリ本体が生きていること
curl.exe -s -o NUL -w "index: %{http_code}`n" https://mente-tracker.pages.dev/
curl.exe -s -o NUL -w "manifest: %{http_code}`n" https://mente-tracker.pages.dev/manifest.json
curl.exe -s -o NUL -w "icon: %{http_code}`n" https://mente-tracker.pages.dev/icon-192.png

# API 認証が生きていること（合言葉なし → 401）
curl.exe -s -X POST https://mente-tracker.pages.dev/api/list -H "Content-Type: application/json" -d "{}" -w "`napi/list: %{http_code}`n"
```

期待値: CLAUDE.md / AGENTS.md / deploy.yml / docs = **404**、
index / manifest / icon = **200**、api/list（合言葉なし）= **401**。

もし CLAUDE.md がまだ 200 のままなら、GitHub Actions の deploy 実行結果を
`gh run list -R uniboo-apps/mente-tracker --limit 3` で確認して原因を直す
（キャッシュではなく Pages は即時反映されるので、200 のままなら strip が効いていない）。

### 3. 完了報告

- 変更ファイル一覧とコミットハッシュ（短縮形）を報告する
- 上記 curl の結果（ステータスコード）を報告する

## 備考

- 過去デプロイのプレビュー URL（`<hash>.mente-tracker.pages.dev`）には旧ファイルが
  残るが、URL が推測不能なハッシュなのでリスクは低い。対応不要（気になるなら
  Cloudflare ダッシュボードから古いデプロイを手動削除できる、程度の認識でよい）。
- 合言葉ガードの平文比較・レート制限なしは、家族2人用アプリとして許容と判断済み。
  今回は対応しない。
