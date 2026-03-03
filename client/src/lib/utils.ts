import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Ensure a phone number has a leading zero for UK click-to-call.
 * Mirrors the normalisePhone logic in server/storage.ts.
 * Returns the original value unchanged if it's already correct or empty.
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  // Strip international UK prefix: 0044 or 44 → leading 0
  if (digits.startsWith("0044") && digits.length === 14) digits = "0" + digits.slice(4);
  else if (digits.startsWith("44") && digits.length === 12) digits = "0" + digits.slice(2);
  // Add leading zero to anything that still doesn't have one
  if (digits.length > 0 && !digits.startsWith("0")) digits = "0" + digits;
  return digits || phone; // fall back to original if result is empty
}
