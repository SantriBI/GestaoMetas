import crypto from "node:crypto"

const ALGORITHM = "aes-256-gcm"
const KEY_HEX = process.env.APP_ENCRYPTION_KEY

export class SecretDecryptError extends Error {
  constructor(message, cause) {
    super(message)
    this.name = "SecretDecryptError"
    this.code = "SECRET_DECRYPT_FAILED"
    this.cause = cause
  }
}

if (!KEY_HEX || !/^[0-9a-f]{64}$/i.test(KEY_HEX) || /^0+$/.test(KEY_HEX)) {
  throw new Error(
    "APP_ENCRYPTION_KEY ausente ou insegura. " +
    "Defina uma chave hex de 64 caracteres (32 bytes) gerada com: " +
    "node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
  )
}

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
  if (!ciphertext || !String(ciphertext).includes(":")) {
    console.warn("SECURITY: decryptSecret recebeu um valor nao-criptografado")
    return ciphertext ?? ""
  }

  try {
    const [ivHex, tagHex, dataHex] = String(ciphertext).split(":")
    const key = getKey()
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"))
    decipher.setAuthTag(Buffer.from(tagHex, "hex"))
    return decipher.update(Buffer.from(dataHex, "hex")) + decipher.final("utf8")
  } catch (error) {
    throw new SecretDecryptError(
      "Falha ao decriptar segredo. A APP_ENCRYPTION_KEY atual nao corresponde a chave usada ao salvar este valor.",
      error
    )
  }
}
