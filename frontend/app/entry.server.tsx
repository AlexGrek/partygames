import { PassThrough } from "node:stream";
import type { AppLoadContext, EntryContext } from "react-router";
import { ServerRouter } from "react-router";
import { renderToPipeableStream } from "react-dom/server";

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext: AppLoadContext,
) {
  return new Promise<Response>((resolve, reject) => {
    const body = new PassThrough();
    const chunks: Buffer[] = [];
    body.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    body.on("end", () => {
      const html = Buffer.concat(chunks).toString("utf-8");
      responseHeaders.set("Content-Type", "text/html");
      resolve(new Response(html, { status: responseStatusCode, headers: responseHeaders }));
    });
    body.on("error", reject);

    const { pipe } = renderToPipeableStream(
      <ServerRouter context={routerContext} url={request.url} />,
      { onAllReady() { pipe(body); }, onShellError: reject },
    );
  });
}
