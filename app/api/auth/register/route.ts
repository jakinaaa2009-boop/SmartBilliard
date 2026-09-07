import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { registerSchema } from "@/lib/validation/schemas";
import { hashSecret } from "@/lib/auth/password";
import { AUTH_COOKIE, authCookieOptions, signAuthToken } from "@/lib/auth/jwt";
import { jsonError, jsonOk, toObject } from "@/lib/utils";
import { readJson } from "@/lib/api";

export async function POST(request: NextRequest) {
  const body = await readJson(request);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.errors[0]?.message || "Буруу өгөгдөл", 400);
  }
  await connectDB();
  const data = parsed.data;
  const exists = await User.findOne({
    $or: [{ phone: data.phone }, ...(data.email ? [{ email: data.email }] : [])],
  });
  if (exists) return jsonError("Бүртгэлтэй хэрэглэгч байна", 409);
  const user = await User.create({
    fullName: data.fullName,
    phone: data.phone,
    email: data.email || undefined,
    passwordHash: await hashSecret(data.password),
    role: "CLIENT",
    status: "ACTIVE",
  });
  const token = await signAuthToken({
    sub: String(user._id),
    role: user.role,
    phone: user.phone,
  });
  const jar = await cookies();
  jar.set(AUTH_COOKIE, token, authCookieOptions());
  return jsonOk({ user: toObject(user) }, 201);
}
