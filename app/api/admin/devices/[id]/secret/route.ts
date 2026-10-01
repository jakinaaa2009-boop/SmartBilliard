import { connectDB } from "@/lib/db/mongoose";
import { Device } from "@/models/Device";
import { requireUser, httpError } from "@/lib/auth/guards";
import { hashSecret } from "@/lib/auth/password";
import { writeAudit } from "@/lib/audit";
import { generateSecret, jsonError, jsonOk } from "@/lib/utils";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireUser(["ADMIN"]);
    const { id } = await params;
    await connectDB();
    const device = (await Device.findById(id)) || (await Device.findOne({ deviceId: id.toUpperCase() }));
    if (!device) return jsonError("Төхөөрөмж олдсонгүй", 404);
    const secret = generateSecret(32);
    device.secretHash = await hashSecret(secret);
    await device.save();
    await writeAudit({
      adminId: admin.id,
      action: "ROTATE_DEVICE_SECRET",
      targetType: "Device",
      targetId: device.deviceId,
    });
    return jsonOk({ secret, deviceId: device.deviceId });
  } catch (error) {
    return httpError(error);
  }
}
