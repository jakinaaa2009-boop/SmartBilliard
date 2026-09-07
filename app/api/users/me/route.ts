import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { Session } from "@/models/Session";
import { Payment } from "@/models/Payment";
import { requireUser, httpError } from "@/lib/auth/guards";
import { profileSchema } from "@/lib/validation/schemas";
import { jsonError, jsonOk, toObject } from "@/lib/utils";
import { readJson } from "@/lib/api";

export async function GET() {
  try {
    const auth = await requireUser();
    await connectDB();
    const user = await User.findById(auth.id);
    const sessions = await Session.find({ userId: auth.id, status: "COMPLETED" }).lean();
    const payments = await Payment.find({ userId: auth.id, status: "PAID" }).lean();
    const totalMinutes = sessions.reduce((sum, s) => sum + s.purchasedMinutes, 0);
    return jsonOk({
      user: toObject(user),
      stats: {
        sessions: sessions.length,
        hours: Math.round((totalMinutes / 60) * 10) / 10,
        spent: payments.reduce((sum, p) => sum + p.amount, 0),
      },
    });
  } catch (error) {
    return httpError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireUser();
    const body = await readJson(request);
    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) return jsonError(parsed.error.errors[0]?.message || "Буруу өгөгдөл");
    await connectDB();
    const taken = await User.findOne({
      _id: { $ne: auth.id },
      $or: [
        { phone: parsed.data.phone },
        ...(parsed.data.email ? [{ email: parsed.data.email }] : []),
      ],
    });
    if (taken) return jsonError("Утас эсвэл имэйл бүртгэлтэй байна", 409);
    const user = await User.findByIdAndUpdate(
      auth.id,
      {
        fullName: parsed.data.fullName,
        phone: parsed.data.phone,
        email: parsed.data.email || undefined,
      },
      { new: true }
    );
    return jsonOk({ user: toObject(user) });
  } catch (error) {
    return httpError(error);
  }
}
