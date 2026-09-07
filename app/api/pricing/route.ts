import { connectDB } from "@/lib/db/mongoose";
import { PricingPlan } from "@/models/PricingPlan";
import { jsonOk } from "@/lib/utils";

export async function GET() {
  await connectDB();
  const plans = await PricingPlan.find({ active: true }).sort({ sortOrder: 1, durationMinutes: 1 }).lean();
  return jsonOk({
    plans: plans.map((p) => ({ ...p, id: String(p._id) })),
  });
}
