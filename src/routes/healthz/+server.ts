import type { RequestHandler } from "./$types";

export const GET: RequestHandler = () =>
  new Response("ok\n", {
    headers: {
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8"
    }
  });
