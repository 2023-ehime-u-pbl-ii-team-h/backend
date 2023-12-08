function encodeBase64Url(array: ArrayBuffer): string {
  const bytes = Array.from(new Uint8Array(array))
    .map((byte) => String.fromCharCode(byte))
    .reduce((str, digit) => str + digit, "");
  return btoa(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export interface PkceKeys {
  verifier: string;
  challenge: string;
}

export async function generatePkceKeys(): Promise<PkceKeys> {
  const randomArray = crypto.getRandomValues(new Uint8Array(32));
  const verifier = encodeBase64Url(randomArray);
  const challengeArray = await crypto.subtle.digest(
    { name: "SHA-256" },
    new TextEncoder().encode(verifier),
  );
  const challenge = encodeBase64Url(challengeArray);

  return { verifier, challenge };
}
