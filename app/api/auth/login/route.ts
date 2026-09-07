import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { loginSchema } from "@/lib/validation/schemas";
import { verifySecret } from "@/lib/auth/password";
import { AUTH_COOKIE, authCookieOptions, signAuthToken } from "@/lib/auth/jwt";
import { jsonError, jsonOk, toObject } from "@/lib/utils";
import { readJson } from "@/lib/api";

export async function POST(request: NextRequest) {
  const body = await readJson<{
    identifier?: string;
    phone?: string;
    email?: string;
    password?: string;
    portal?: "CLIENT" | "ADMIN";
  }>(request);
  const parsed = loginSchema.safeParse({
    identifier: body.identifier || body.phone || body.email,
    password: body.password,
  });
  if (!parsed.success) {
    return jsonError(parsed.error.errors[0]?.message || "Буруу өгөгдөл", 400);
  }
  await connectDB();
  const identifier = parsed.data.identifier.trim();
  const user = await User.findOne({
    $or: [{ phone: identifier }, { email: identifier.toLowerCase() }],
  });
  if (!user) return jsonError("Нэвтрэх нэр эсвэл нууц үг буруу", 401);
  const ok = await verifySecret(parsed.data.password, user.passwordHash);
  if (!ok) return jsonError("Нэвтрэх нэр эсвэл нууц үг буруу", 401);
  if (user.status === "BLOCKED") return jsonError("Таны бүртгэл хаагдсан байна", 403);
  if (body.portal === "ADMIN" && user.role !== "ADMIN") {
    return jsonError("Энэ хуудас зөвхөн операторт зориулагдсан", 403);
  }
  if (body.portal === "CLIENT" && user.role === "ADMIN") {
    return jsonError("Админ нэвтрэх: /admin/login", 403);
  }
  const token = await signAuthToken({
    sub: String(user._id),
    role: user.role,
    phone: user.phone,
  });
  const jar = await cookies();
  jar.set(AUTH_COOKIE, token, authCookieOptions());
  return jsonOk({ user: toObject(user) });
}
