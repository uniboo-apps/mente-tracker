// POST /api/create — 新しいメンテ項目を追加
// body: { name, lastDate?, cycleDays?, memo?, url? }
const DB_ID = "3234b6f3-2895-80b2-8880-cd22acf84b21";
const NV = "2022-06-28";

export async function onRequestPost({ request, env }) {
  const bad = await guard(request, env);
  if (bad) return bad;

  let body;
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  if (!body.name) return json({ error: "name required" }, 400);

  const props = { "名前": { title: [{ text: { content: body.name } }] } };
  if (body.lastDate) props["最終メンテ日"] = { date: { start: body.lastDate } };
  if (body.cycleDays !== undefined && body.cycleDays !== null && body.cycleDays !== "")
    props["周期日数"] = { number: Number(body.cycleDays) };
  if (body.memo) props["メモ"] = { rich_text: [{ text: { content: body.memo } }] };
  if (body.url) props["取説_お手入れ"] = { url: body.url };

  const res = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.NOTION_TOKEN}`,
      "Notion-Version": NV,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ parent: { database_id: DB_ID }, properties: props }),
  });
  if (!res.ok) {
    const t = await res.text();
    return json({ error: "notion", status: res.status, detail: t }, 502);
  }
  return json({ ok: true });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
async function guard(request, env) {
  if (!env.APP_PASSCODE) return null;
  const got = request.headers.get("x-app-pass") || "";
  if (got !== env.APP_PASSCODE) return json({ error: "unauthorized" }, 401);
  return null;
}
