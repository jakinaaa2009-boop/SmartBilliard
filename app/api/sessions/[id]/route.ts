import { connectDB } from "@/lib/db/mongoose";
import { Session } from "@/models/Session";
import { Table } from "@/models/Table";
import { Device } from "@/models/Device";
import { Payment } from "@/models/Payment";
import { requireUser, httpError } from "@/lib/auth/guards";
import { jsonError, jsonOk } from "@/lib/utils";
import { asDoc } from "@/lib/db/as-doc";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await connectDB();
    const session = asDoc(await Session.findById(id).lean());
    if (!session) return jsonError("Сесс олдсонгүй", 404);
    if (String(session.userId) !== user.id && user.role !== "ADMIN") {
      return jsonError("Эрх хүрэхгүй", 403);
    }
    const [table, device, payments] = await Promise.all([
      Table.findById(session.tableId).lean().then(asDoc),
      Device.findOne({ deviceId: session.deviceId }).lean().then(asDoc),
      Payment.find({ sessionId: session._id }).sort({ createdAt: -1 }).lean(),
    ]);
    return jsonOk({
      session: { ...session, id: String(session._id) },
      table: table ? { ...table, id: String(table._id) } : null,
      device: device
        ? {
            deviceId: device.deviceId,
            online: device.status === "ONLINE",
            boxStatus: device.boxStatus,
            ballCount: device.detectedBallCount,
            expectedBallCount: device.expectedBallCount,
            alarm: device.alarmStatus,
            operationalState: device.operationalState,
          }
        : null,
      payments: payments.map((p) => ({ ...p, id: String(p._id) })),
    });
  } catch (error) {
    return httpError(error);
  }
}
