// /api/* 全体の合言葉ガード
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
