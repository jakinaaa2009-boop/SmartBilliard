import { NextRequest } from "next/server";
import { encodeSse, subscribe } from "@/lib/realtime/sse";
import { readLiveState } from "@/lib/realtime/live-state";
import { getAuthUser } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(encodeSse(event, data)));
        } catch {
          closed = true;
        }
      };
      send("hello", { ok: true, channel });

      let lastLive = "";
      let reading = false;
      const pushLive = () => {
        if (closed || reading || channel !== "admin") return;
        reading = true;
        void readLiveState()
          .then((devices) => {
            const next = JSON.stringify(devices);
            if (next !== lastLive) {
              lastLive = next;
              send("message", { type: "live", devices });
            }
          })
          .catch(() => {
            /* database blip; the next tick retries */
          })
          .finally(() => {
            reading = false;
          });
      };
      pushLive();
      const liveTimer = setInterval(pushLive, 400);

      const unsubscribe = subscribe(channel, (data) => {
        send("message", data);
        pushLive();
      });
      const ping = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          closed = true;
        }
      }, 15000);
      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(liveTimer);
        clearInterval(ping);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      };
      request.signal.addEventListener("abort", close);
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
