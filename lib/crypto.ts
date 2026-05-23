import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) throw new Error("ENCRYPTION_KEY environment variable is required");
  return Buffer.from(secret, "hex");
}

export function encrypt(text: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const tag = cipher.getAuthTag();

  return iv.toString("hex") + tag.toString("hex") + encrypted;
}

export function decrypt(encryptedText: string): string {
  const key = getKey();
  const iv = Buffer.from(encryptedText.slice(0, IV_LENGTH * 2), "hex");
  const tag = Buffer.from(
    encryptedText.slice(IV_LENGTH * 2, (IV_LENGTH + TAG_LENGTH) * 2),
    "hex"
  );
  const encrypted = encryptedText.slice((IV_LENGTH + TAG_LENGTH) * 2);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
