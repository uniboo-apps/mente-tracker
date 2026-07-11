// POST /api/update — ページのプロパティを更新
// body: { id, lastDate?, cycleDays?, memo?, name?, url? }
// 「今日やった」は lastDate に今日(YYYY-MM-DD)を渡すだけ
const NV = "2022-06-28";

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const { id } = body;
  if (!id) return json({ error: "id required" }, 400);
  if (!/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(id))
    return json({ error: "bad id" }, 400);

  const props = {};
  if ("lastDate" in body) {
    props["最終メンテ日"] = body.lastDate ? { date: { start: body.lastDate } } : { date: null };
  }
  if ("cycleDays" in body) {
    props["周期日数"] = { number: body.cycleDays === null || body.cycleDays === "" ? null : Number(body.cycleDays) };
  }
  if ("memo" in body) {
    props["メモ"] = { rich_text: body.memo ? [{ text: { content: body.memo } }] : [] };
  }
  if ("name" in body) {
    props["名前"] = { title: body.name ? [{ text: { content: body.name } }] : [] };
  }
  if ("url" in body) {
    if (body.url && !/^https?:\/\//i.test(body.url)) return json({ error: "bad url" }, 400);
    props["取説_お手入れ"] = { url: body.url || null };
  }
  if (Object.keys(props).length === 0) return json({ error: "no fields" }, 400);

  const res = await fetch(`https://api.notion.com/v1/pages/${id}`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${env.NOTION_TOKEN}`,
      "Notion-Version": NV,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ properties: props }),
  });
  if (!res.ok) {
    console.log("notion error", res.status, await res.text());
    return json({ error: "notion", status: res.status }, 502);
  }
  return json({ ok: true });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
