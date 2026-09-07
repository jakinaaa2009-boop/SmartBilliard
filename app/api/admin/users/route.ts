import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { Session } from "@/models/Session";
import { Payment } from "@/models/Payment";
import { requireUser, httpError } from "@/lib/auth/guards";
import { jsonOk } from "@/lib/utils";
import { query } from "@/lib/api";

export async function GET(request: NextRequest) {
  try {
    await requireUser(["ADMIN"]);
    await connectDB();
    const q = query(request);
    const filter: Record<string, unknown> = { role: "CLIENT" };
    if (q.status) filter.status = q.status;
    if (q.search) {
      filter.$or = [
        { fullName: { $regex: q.search, $options: "i" } },
        { phone: { $regex: q.search, $options: "i" } },
        { email: { $regex: q.search, $options: "i" } },
      ];
    }
    const users = await User.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    const ids = users.map((u) => u._id);
    const [sessionCounts, spends] = await Promise.all([
      Session.aggregate([
        { $match: { userId: { $in: ids } } },
        { $group: { _id: "$userId", count: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        { $match: { userId: { $in: ids }, status: "PAID" } },
        { $group: { _id: "$userId", total: { $sum: "$amount" } } },
      ]),
    ]);
    const sc = new Map(sessionCounts.map((s) => [String(s._id), s.count]));
    const sp = new Map(spends.map((s) => [String(s._id), s.total]));
    return jsonOk({
      users: users.map((u) => ({
        ...u,
        id: String(u._id),
        passwordHash: undefined,
        sessions: sc.get(String(u._id)) || 0,
        totalSpent: sp.get(String(u._id)) || 0,
      })),
    });
  } catch (error) {
    return httpError(error);
  }
}
