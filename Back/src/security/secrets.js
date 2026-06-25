import crypto from "node:crypto"

const ALGORITHM = "aes-256-gcm"
const KEY_HEX = process.env.APP_ENCRYPTION_KEY ?? "0".repeat(64)

function getKey() {
  return Buffer.from(KEY_HEX, "hex")
}

export function encryptSecret(plaintext) {
  const key = getKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`
}

export function decryptSecret(ciphertext) {
  if (!ciphertext || !String(ciphertext).includes(":")) return ciphertext ?? ""
  const [ivHex, tagHex, dataHex] = String(ciphertext).split(":")
  const key = getKey()
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"))
  decipher.setAuthTag(Buffer.from(tagHex, "hex"))
  return decipher.update(Buffer.from(dataHex, "hex")) + decipher.final("utf8")
}
