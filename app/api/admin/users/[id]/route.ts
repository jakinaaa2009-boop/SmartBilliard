import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { Session } from "@/models/Session";
import { Payment } from "@/models/Payment";
import { requireUser, httpError } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { jsonError, jsonOk, toObject } from "@/lib/utils";
import { asDoc } from "@/lib/db/as-doc";
import { readJson } from "@/lib/api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser(["ADMIN"]);
    const { id } = await params;
    await connectDB();
    const user = asDoc(await User.findById(id).lean());
    if (!user) return jsonError("Хэрэглэгч олдсонгүй", 404);
    const [sessions, payments] = await Promise.all([
      Session.find({ userId: id }).sort({ createdAt: -1 }).limit(50).lean(),
      Payment.find({ userId: id }).sort({ createdAt: -1 }).limit(50).lean(),
    ]);
    return jsonOk({
      user: { ...user, id: String(user._id), passwordHash: undefined },
      sessions: sessions.map((s) => ({ ...s, id: String(s._id) })),
      payments: payments.map((p) => ({ ...p, id: String(p._id) })),
    });
  } catch (error) {
    return httpError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireUser(["ADMIN"]);
    const { id } = await params;
    const body = await readJson<{
      fullName?: string;
      phone?: string;
      email?: string;
      status?: "ACTIVE" | "BLOCKED";
      reason?: string;
    }>(request);
    await connectDB();
    const user = await User.findById(id);
    if (!user) return jsonError("Хэрэглэгч олдсонгүй", 404);
    const old = { fullName: user.fullName, phone: user.phone, email: user.email, status: user.status };
    if (body.fullName) user.fullName = body.fullName;
    if (body.phone) user.phone = body.phone;
    if (body.email !== undefined) user.email = body.email || undefined;
    if (body.status) user.status = body.status;
    await user.save();
    await writeAudit({
      adminId: admin.id,
      action: body.status && body.status !== old.status
        ? body.status === "BLOCKED"
          ? "BLOCK_USER"
          : "UNBLOCK_USER"
        : "UPDATE_USER",
      targetType: "User",
      targetId: id,
      oldValue: old,
      newValue: { fullName: user.fullName, phone: user.phone, email: user.email, status: user.status },
      reason: body.reason,
    });
    return jsonOk({ user: toObject(user) });
  } catch (error) {
    return httpError(error);
  }
}
