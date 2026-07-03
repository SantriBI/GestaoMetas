from __future__ import annotations

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from .config import app_encryption_key_hex


def decrypt_secret(ciphertext: str | None) -> str:
    """Decrypt secrets stored by Back/src/security/secrets.js."""
    if not ciphertext:
        return ""

    value = str(ciphertext)
    if ":" not in value:
        return value

    iv_hex, tag_hex, data_hex = value.split(":", 2)
    key = bytes.fromhex(app_encryption_key_hex())
    iv = bytes.fromhex(iv_hex)
    tag = bytes.fromhex(tag_hex)
    data = bytes.fromhex(data_hex)

    return AESGCM(key).decrypt(iv, data + tag, None).decode("utf-8")
