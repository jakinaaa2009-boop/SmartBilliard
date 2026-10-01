import { User } from "@/models/User";
import { hashSecret, verifySecret } from "@/lib/auth/password";

let pending: Promise<void> | null = null;

/** Create or align the operator account from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD. */
export function ensureSeedAdmin() {
  if (!pending) {
    pending = syncSeedAdmin().catch((error) => {
      pending = null;
      throw error;
    });
  }
  return pending;
}

async function syncSeedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) return;

  const phone = process.env.SEED_ADMIN_PHONE?.trim() || "88001100";
  const existing = await User.findOne({ email });

  if (!existing) {
    try {
      await User.create({
        fullName: "Club Admin",
        phone,
        email,
        passwordHash: await hashSecret(password),
        role: "ADMIN",
        status: "ACTIVE",
      });
      console.info("[auth] Created admin from SEED_ADMIN_EMAIL");
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
    }
    return;
  }

  const passwordOk = await verifySecret(password, existing.passwordHash);
  const aligned = existing.role === "ADMIN" && existing.status === "ACTIVE" && passwordOk;
  if (aligned) return;

  existing.role = "ADMIN";
  existing.status = "ACTIVE";
  if (!passwordOk) existing.passwordHash = await hashSecret(password);
  await existing.save();
  console.info("[auth] Synced admin from SEED_ADMIN_EMAIL");
}
