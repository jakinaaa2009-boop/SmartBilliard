type Listener = (data: unknown) => void;

declare global {
  // eslint-disable-next-line no-var
  var __sbRealtime: Map<string, Set<Listener>> | undefined;
}

const channels = global.__sbRealtime || new Map<string, Set<Listener>>();
if (!global.__sbRealtime) global.__sbRealtime = channels;

export function subscribe(channel: string, listener: Listener) {
  if (!channels.has(channel)) channels.set(channel, new Set());
  channels.get(channel)!.add(listener);
  return () => {
    channels.get(channel)?.delete(listener);
  };
}

export function publish(channel: string, data: unknown) {
  channels.get(channel)?.forEach((fn) => {
    try {
      fn(data);
    } catch {
      /* ignore */
    }
  });
  channels.get("admin")?.forEach((fn) => {
    try {
      fn({ channel, ...((data as object) || {}) });
    } catch {
      /* ignore */
    }
  });
}

export function encodeSse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
