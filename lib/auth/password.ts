import bcrypt from "bcryptjs";

const ROUNDS = 12;

export async function hashSecret(value: string) {
  return bcrypt.hash(value, ROUNDS);
}

export async function verifySecret(value: string, hash: string) {
  return bcrypt.compare(value, hash);
}
