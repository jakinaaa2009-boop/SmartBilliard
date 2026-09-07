import { isMockIotEnabled, isMockPaymentEnabled, jsonOk } from "@/lib/utils";
import { getAuthUser } from "@/lib/auth/guards";

export async function GET() {
  const user = await getAuthUser();
  return jsonOk({
    mockPayment: isMockPaymentEnabled(),
    mockIot: isMockIotEnabled() && user?.role === "ADMIN",
    authenticated: Boolean(user),
    role: user?.role || null,
  });
}
