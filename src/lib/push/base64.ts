/** Converts a URL-safe base64 VAPID public key (as `web-push generate-vapid-keys`
 * prints it) into the Uint8Array PushManager.subscribe's applicationServerKey wants. */
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
