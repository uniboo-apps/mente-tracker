// /api/* 全体の合言葉ガード。設定不備でも認証を通さない。
function jsonError(error, status) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function onRequest({ request, env, next }) {
  const passcode = env?.APP_PASSCODE;
  if (
    typeof passcode !== "string" ||
    passcode.trim() === "" ||
    passcode.length > 1024 ||
    /[\u0000-\u001f\u007f]/.test(passcode)
  ) {
    return jsonError("auth_unavailable", 503);
  }

  const supplied = request.headers.get("x-app-pass");
  if (supplied === null || supplied !== passcode) {
    return jsonError("unauthorized", 401);
  }

  return next();
}
