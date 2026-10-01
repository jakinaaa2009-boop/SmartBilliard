import { connectDB } from "@/lib/db/mongoose";
import { PricingPlan } from "@/models/PricingPlan";
import { jsonOk } from "@/lib/utils";

export async function GET() {
  await connectDB();
  const testPlan = await PricingPlan.findOne({ durationMinutes: 1 });
  if (!testPlan) {
    await PricingPlan.create({
      name: "1 минут",
      durationMinutes: 1,
      price: 100,
      active: true,
      popular: false,
      sortOrder: 0,
    });
  }
  const plans = await PricingPlan.find({ active: true }).sort({ sortOrder: 1, durationMinutes: 1 }).lean();
  return jsonOk({
    plans: plans.map((p) => ({ ...p, id: String(p._id) })),
  });
}
