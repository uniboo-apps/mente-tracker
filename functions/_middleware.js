// Static asset storage can retain files from older Pages deployments. Block
// development-only paths explicitly so they cannot be served by a stale asset.
export async function onRequest({ request, next }) {
  const path = new URL(request.url).pathname;
  if (
    path === "/CLAUDE.md" ||
    path === "/AGENTS.md" ||
    path === "/.github/workflows/deploy.yml" ||
    path.startsWith("/docs/")
  ) {
    return new Response("Not Found", { status: 404 });
  }
  return next();
}
