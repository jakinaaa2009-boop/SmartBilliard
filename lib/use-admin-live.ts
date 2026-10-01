"use client";

import { useEffect, useMemo, useState } from "react";
import type { LiveDevice } from "@/lib/realtime/live-state";

export function useAdminLive() {
  const [devices, setDevices] = useState<LiveDevice[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let source: EventSource | null = null;
    let retry = 0;
    let stopped = false;

    const connect = () => {
      source = new EventSource("/api/realtime?channel=admin");
      source.addEventListener("message", (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data) as { type?: string; devices?: LiveDevice[] };
          if (data.type === "live" && Array.isArray(data.devices)) {
            setDevices(data.devices);
            setConnected(true);
          }
        } catch {
          /* ignore malformed frames */
        }
      });
      source.onerror = () => {
        setConnected(false);
        source?.close();
        if (!stopped) retry = window.setTimeout(connect, 800);
      };
    };

    connect();
    return () => {
      stopped = true;
      window.clearTimeout(retry);
      source?.close();
    };
  }, []);

  const byDeviceId = useMemo(() => {
    const map = new Map<string, LiveDevice>();
    for (const device of devices) map.set(device.deviceId, device);
    return map;
  }, [devices]);

  return { devices, byDeviceId, connected };
}
