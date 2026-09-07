import { connectDB } from "@/lib/db/mongoose";
import { expireActiveSessions, expirePendingPayments, processBallReturnAlarms } from "@/lib/session/engine";
import { markStaleDevicesOffline } from "@/lib/iot/heartbeat";

declare global {
  // eslint-disable-next-line no-var
  var __sbScheduler: NodeJS.Timeout | undefined;
}

export function startScheduler() {
  if (global.__sbScheduler) return;
  global.__sbScheduler = setInterval(() => {
    void tick();
  }, 5000);
  void tick();
}

async function tick() {
  try {
    await connectDB();
    await expirePendingPayments();
    await expireActiveSessions();
    await processBallReturnAlarms();
    await markStaleDevicesOffline();
  } catch (error) {
    console.error("[scheduler]", error);
  }
}
