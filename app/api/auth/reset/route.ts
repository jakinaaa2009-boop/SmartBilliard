import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { hashSecret, verifySecret } from "@/lib/auth/password";
import { jsonError, jsonOk } from "@/lib/utils";
import { readJson } from "@/lib/api";

export async function POST(request: NextRequest) {
  const body = await readJson<{ identifier?: string; token?: string; password?: string }>(request);
  if (!body.identifier || !body.token || !body.password) {
    return jsonError("Мэдээлэл дутуу байна");
  }
  if (body.password.length < 6) return jsonError("Нууц үг хамгийн багадаа 6 тэмдэгт");
  await connectDB();
  const user = await User.findOne({
    $or: [{ phone: body.identifier }, { email: body.identifier.toLowerCase() }],
  });
  if (!user?.resetToken || !user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
    return jsonError("Холбоос хүчингүй эсвэл хугацаа дууссан", 400);
  }
  const ok = await verifySecret(body.token, user.resetToken);
  if (!ok) return jsonError("Холбоос хүчингүй", 400);
  user.passwordHash = await hashSecret(body.password);
  user.resetToken = undefined;
  user.resetTokenExpiresAt = undefined;
  await user.save();
  return jsonOk({ message: "Нууц үг шинэчлэгдлээ" });
}
