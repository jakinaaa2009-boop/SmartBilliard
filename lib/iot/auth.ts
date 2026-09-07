import { Device } from "@/models/Device";
import { verifySecret } from "@/lib/auth/password";

export async function authenticateDevice(request: Request, deviceId: string) {
  const header = request.headers.get("authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    const err = new Error("UNAUTHORIZED");
    throw err;
  }
  const device = await Device.findOne({ deviceId: deviceId.toUpperCase() });
  if (!device) throw new Error("DEVICE_NOT_FOUND");
  const ok = await verifySecret(token, device.secretHash);
  if (!ok) throw new Error("UNAUTHORIZED");
  return device;
}
