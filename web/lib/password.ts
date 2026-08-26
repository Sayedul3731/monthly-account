/**
 * Deterministic one-way digest of the password for the request body.
 * The API still bcrypt-hashes this value before storage.
 */
export async function hashPasswordForTransport(
  password: string,
): Promise<string> {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
