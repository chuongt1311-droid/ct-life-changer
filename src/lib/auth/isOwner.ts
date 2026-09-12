/** Spec §4.2: the server rejects any signed-in user whose email isn't the
 * single configured owner. This is the one place that rule lives. */
export function isOwner(email: string | null | undefined): boolean {
  const ownerEmail = process.env.OWNER_EMAIL;
  if (!ownerEmail || !email) return false;
  return email.toLowerCase() === ownerEmail.toLowerCase();
}
