import { connectDB } from "@/lib/db/mongoose";
import { Table } from "@/models/Table";
import { Device } from "@/models/Device";
import { Session } from "@/models/Session";
import { User } from "@/models/User";
import { jsonError, jsonOk } from "@/lib/utils";
import { asDoc } from "@/lib/db/as-doc";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const { deviceId } = await params;
  await connectDB();
  const device = asDoc(await Device.findOne({ deviceId: deviceId.toUpperCase() }).lean());
  if (!device) return jsonError("Төхөөрөмж олдсонгүй", 404);
  const table = asDoc(
    device.tableId
      ? await Table.findById(device.tableId).lean()
      : await Table.findOne({ deviceId: device.deviceId }).lean()
  );
  if (!table) return jsonError("Ширээ холбогдоогүй байна", 404);
  const session = asDoc(
    await Session.findOne({
      tableId: table._id,
      status: { $in: ["ACTIVE", "EXTENDED", "RETURN_REQUIRED", "BALLS_MISSING"] },
    }).lean()
  );
  let user = null;
  if (session) {
    user = asDoc(await User.findById(session.userId).select("fullName phone").lean());
  }
  return jsonOk({
    table: { ...table, id: String(table._id) },
    device: {
      ...device,
      id: String(device._id),
      secretHash: undefined,
      online: device.status === "ONLINE",
    },
    session: session
      ? {
          ...session,
          id: String(session._id),
          user: user ? { fullName: user.fullName, phone: user.phone } : null,
        }
      : null,
  });
}
