import { NextRequest } from "next/server";
import { encodeSse, subscribe } from "@/lib/realtime/sse";
import { getAuthUser } from "@/lib/auth/guards";

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const channel = request.nextUrl.searchParams.get("channel") || (user.role === "ADMIN" ? "admin" : `user:${user.id}`);
  if (channel === "admin" && user.role !== "ADMIN") {
    return new Response("Forbidden", { status: 403 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(encodeSse("hello", { ok: true, channel })));
      const unsubscribe = subscribe(channel, (data) => {
        try {
          controller.enqueue(encoder.encode(encodeSse("message", data)));
        } catch {
          /* closed */
        }
      });
      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          /* closed */
        }
      }, 15000);
      request.signal.addEventListener("abort", () => {
        clearInterval(ping);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
