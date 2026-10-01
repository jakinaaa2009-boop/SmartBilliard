import { connectDB } from "@/lib/db/mongoose";
import { PricingPlan } from "@/models/PricingPlan";
import { jsonOk } from "@/lib/utils";

const DEFAULT_PLANS = [
  { name: "1 минут", durationMinutes: 1, price: 100, popular: false, sortOrder: 0 },
  { name: "30 минут", durationMinutes: 30, price: 2500, popular: false, sortOrder: 1 },
  { name: "1 цаг", durationMinutes: 60, price: 5000, popular: true, sortOrder: 2 },
  { name: "2 цаг", durationMinutes: 120, price: 9500, popular: false, sortOrder: 3 },
];

export async function GET() {
  await connectDB();
  for (const plan of DEFAULT_PLANS) {
    const existing = await PricingPlan.findOne({ durationMinutes: plan.durationMinutes });
    if (!existing) {
      await PricingPlan.create({ ...plan, active: true });
    }
  }
  const plans = await PricingPlan.find({ active: true }).sort({ sortOrder: 1, durationMinutes: 1 }).lean();
  return jsonOk({
    plans: plans.map((p) => ({ ...p, id: String(p._id) })),
  });
}
