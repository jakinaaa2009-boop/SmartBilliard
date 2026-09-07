import { connectDB } from "@/lib/db/mongoose";
import { Table } from "@/models/Table";
import { Device } from "@/models/Device";
import { Session } from "@/models/Session";
import { jsonError, jsonOk } from "@/lib/utils";
import { asDoc } from "@/lib/db/as-doc";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await connectDB();
  const table = asDoc(await Table.findById(id).lean());
  if (!table) return jsonError("Ширээ олдсонгүй", 404);
  const device = table.deviceId ? asDoc(await Device.findOne({ deviceId: table.deviceId }).lean()) : null;
  const session = asDoc(
    await Session.findOne({
      tableId: table._id,
      status: { $in: ["ACTIVE", "EXTENDED", "RETURN_REQUIRED", "BALLS_MISSING"] },
    }).lean()
  );
  return jsonOk({
    table: { ...table, id: String(table._id) },
    device,
    session: session ? { ...session, id: String(session._id) } : null,
  });
}
