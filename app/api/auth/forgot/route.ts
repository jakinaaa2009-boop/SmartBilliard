import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { hashSecret } from "@/lib/auth/password";
import { generateSecret, jsonError, jsonOk, isMockPaymentEnabled } from "@/lib/utils";
import { readJson } from "@/lib/api";

export async function POST(request: NextRequest) {
  const body = await readJson<{ identifier?: string }>(request);
  if (!body.identifier) return jsonError("Утас эсвэл имэйл оруулна уу");
  await connectDB();
  const user = await User.findOne({
    $or: [{ phone: body.identifier }, { email: body.identifier.toLowerCase() }],
  });
  if (!user) {
    return jsonOk({ message: "Хэрэв бүртгэл байвал нууц үг сэргээх холбоос илгээгдлээ" });
  }
  const token = generateSecret(16);
  user.resetToken = await hashSecret(token);
  user.resetTokenExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
  await user.save();
  const resetUrl = `/reset-password?phone=${encodeURIComponent(user.phone)}&token=${token}`;
  return jsonOk({
    message: "Хэрэв бүртгэл байвал нууц үг сэргээх холбоос илгээгдлээ",
    ...(process.env.NODE_ENV !== "production" || isMockPaymentEnabled() ? { resetUrl, token } : {}),
  });
}
