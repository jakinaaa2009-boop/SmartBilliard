import { connectDB } from "@/lib/db/mongoose";
import { Session } from "@/models/Session";
import { requireUser, httpError } from "@/lib/auth/guards";
import { endSession } from "@/lib/session/engine";
import { jsonError, jsonOk, toObject } from "@/lib/utils";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await connectDB();
    const session = await Session.findById(id);
    if (!session) return jsonError("Сесс олдсонгүй", 404);
    if (String(session.userId) !== user.id && user.role !== "ADMIN") {
      return jsonError("Эрх хүрэхгүй", 403);
    }
    const updated = await endSession(id);
    return jsonOk({ session: toObject(updated) });
  } catch (error) {
    return httpError(error);
  }
}
