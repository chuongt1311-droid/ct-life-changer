export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

/** Reads the VAPID key pair CT generated with `npx web-push generate-vapid-keys`
 * and pasted into .env.local/Vercel — Claude never sees the real values. */
export function getVapidConfig(): VapidConfig {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    throw new Error('Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT — set them in .env.local.');
  }
  return { publicKey, privateKey, subject };
}
