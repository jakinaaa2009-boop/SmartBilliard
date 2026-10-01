import { connectDB, getMongoUri } from "@/lib/db/mongoose";
import { expireActiveSessions, expirePendingPayments, processBallReturnAlarms } from "@/lib/session/engine";
import { markStaleDevicesOffline } from "@/lib/iot/heartbeat";

declare global {
  // eslint-disable-next-line no-var
  var __sbScheduler: NodeJS.Timeout | undefined;
  var __sbSchedulerMissingUriWarned: boolean | undefined;
}

export function startScheduler() {
  if (global.__sbScheduler) return;
  global.__sbScheduler = setInterval(() => {
    void tick();
  }, 5000);
  void tick();
}

export async function runSchedulerTick() {
  return tick();
}

async function tick() {
  if (!getMongoUri()) {
    if (!global.__sbSchedulerMissingUriWarned) {
      global.__sbSchedulerMissingUriWarned = true;
      console.warn("[scheduler] MONGODB_URI is not set; jobs paused until it is available");
    }
    return;
  }
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
