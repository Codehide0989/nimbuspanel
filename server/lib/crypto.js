const crypto = require("crypto");

/**
 * Decrypt AES-256-GCM ciphertext produced by the frontend.
 * Format: ivHex:authTagHex:encryptedHex
 * Uses APP_SECRET (must match the frontend) as the key source.
 */
function decrypt(ciphertext) {
  const secret = process.env.APP_SECRET;
  if (!secret) throw new Error("APP_SECRET not set");

  const key = crypto.scryptSync(secret, "nimbuspanel-salt", 32);
  const [ivHex, authTagHex, encrypted] = ciphertext.split(":");
  if (!ivHex || !authTagHex || !encrypted) throw new Error("Invalid encrypted format");

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

module.exports = { decrypt };
