// POST /api/list — 定期メンテDBを取得して正規化して返す
const DB_ID = "3234b6f3-2895-80b2-8880-cd22acf84b21";
const NV = "2022-06-28";

function rt(arr) { return (arr || []).map(x => x.plain_text).join(""); }

export async function onRequestPost({ request, env }) {
  const bad = await guard(request, env);
  if (bad) return bad;

  const res = await fetch(`https://api.notion.com/v1/databases/${DB_ID}/query`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.NOTION_TOKEN}`,
      "Notion-Version": NV,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ page_size: 100 }),
  });
  if (!res.ok) {
    const t = await res.text();
    return json({ error: "notion", status: res.status, detail: t }, 502);
  }
  const data = await res.json();
  const items = data.results.map(pg => {
    const p = pg.properties;
    return {
      id: pg.id,
      name: rt(p["名前"]?.title),
      lastDate: p["最終メンテ日"]?.date?.start || null,
      cycleDays: p["周期日数"]?.number ?? null,
      cycleText: rt(p["メンテ周期"]?.rich_text),
      url: p["取説_お手入れ"]?.url || null,
      memo: rt(p["メモ"]?.rich_text),
    };
  });
  return json({ items });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
async function guard(request, env) {
  if (!env.APP_PASSCODE) return null; // 未設定なら認証なし（ローカル開発用）
  const got = request.headers.get("x-app-pass") || "";
  if (got !== env.APP_PASSCODE) return json({ error: "unauthorized" }, 401);
  return null;
}
