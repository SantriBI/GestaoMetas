// One-off, idempotent migration to encrypt any oracle_password rows left as
// plaintext by the encryption-at-rest regression.
//
// Run order:
//   1. Deploy the code fix that restores encryptSecret/decryptSecret usage.
//   2. Set APP_ENCRYPTION_KEY (must match the key already used for any
//      previously-encrypted rows).
//   3. node Back/scripts/migrate-oracle-passwords.js            (dry-run, default)
//   4. Review the printed summary table.
//   5. node Back/scripts/migrate-oracle-passwords.js --apply     (writes changes)
//
// Safe to re-run: rows already in the encrypted format are never re-encrypted.

import centralPool from "../src/db/mysql.js"
import { encryptSecret, decryptSecret, SecretDecryptError } from "../src/security/secrets.js"

const LEGACY_ENCRYPTED_PASSWORD_RE = /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/i

const APPLY = process.argv.includes("--apply")

function classify(org) {
  const raw = org.oracle_password
  if (raw === null || raw === undefined || String(raw).trim() === "") {
    return { classification: "EMPTY", detail: null }
  }

  const value = String(raw)
  if (LEGACY_ENCRYPTED_PASSWORD_RE.test(value)) {
    try {
      decryptSecret(value)
      return { classification: "ENCRYPTED", detail: null }
    } catch (error) {
      if (error instanceof SecretDecryptError) {
        return { classification: "KEY_MISMATCH", detail: "decrypt failed with current APP_ENCRYPTION_KEY" }
      }
      throw error
    }
  }

  return { classification: "PLAINTEXT", detail: null }
}

async function migrateRow(org) {
  const encrypted = encryptSecret(org.oracle_password)
  const conn = await centralPool.getConnection()
  try {
    await conn.beginTransaction()
    await conn.query(
      "UPDATE organizacoes_auth SET oracle_password = ? WHERE id_organizacao = ?",
      [encrypted, org.id_organizacao]
    )
    await conn.commit()
  } catch (error) {
    await conn.rollback()
    throw error
  } finally {
    conn.release()
  }
}

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY (writes enabled)" : "DRY-RUN (no writes)"}`)
  if (!APPLY) {
    console.log("Pass --apply to persist changes after reviewing this output.\n")
  }

  const [orgs] = await centralPool.query(
    "SELECT id_organizacao, nome, oracle_password FROM organizacoes_auth ORDER BY id_organizacao"
  )

  const rows = []
  for (const org of orgs) {
    const { classification, detail } = classify(org)
    let action = "none"

    if (classification === "PLAINTEXT") {
      if (APPLY) {
        await migrateRow(org)
        action = "encrypted"
      } else {
        action = "would encrypt"
      }
    } else if (classification === "KEY_MISMATCH") {
      action = "skipped (needs operator review)"
    } else if (classification === "EMPTY") {
      action = "skipped (empty)"
    } else {
      action = "already encrypted"
    }

    rows.push({
      id_organizacao: org.id_organizacao,
      nome: org.nome,
      classification,
      action,
      detail: detail ?? "",
    })
  }

  const widths = {
    id_organizacao: Math.max(2, ...rows.map((r) => String(r.id_organizacao).length)),
    nome: Math.max(4, ...rows.map((r) => String(r.nome).length)),
    classification: Math.max(14, ...rows.map((r) => r.classification.length)),
    action: Math.max(6, ...rows.map((r) => r.action.length)),
  }

  const header = [
    "id".padEnd(widths.id_organizacao),
    "nome".padEnd(widths.nome),
    "classification".padEnd(widths.classification),
    "action".padEnd(widths.action),
  ].join("  ")
  console.log(header)
  console.log("-".repeat(header.length))

  for (const row of rows) {
    console.log(
      [
        String(row.id_organizacao).padEnd(widths.id_organizacao),
        String(row.nome).padEnd(widths.nome),
        row.classification.padEnd(widths.classification),
        row.action.padEnd(widths.action),
      ].join("  ") + (row.detail ? `  (${row.detail})` : "")
    )
  }

  const summary = rows.reduce((acc, row) => {
    acc[row.classification] = (acc[row.classification] ?? 0) + 1
    return acc
  }, {})
  console.log("\nSummary:", summary)

  if (!APPLY && summary.PLAINTEXT) {
    console.log(`\n${summary.PLAINTEXT} row(s) would be encrypted. Re-run with --apply to persist.`)
  }
  if (summary.KEY_MISMATCH) {
    console.log(
      `\nWARNING: ${summary.KEY_MISMATCH} row(s) are encrypted but do not decrypt with the current ` +
      "APP_ENCRYPTION_KEY. They were left untouched. Verify the key or re-save those organizations' passwords."
    )
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Migration failed:", error instanceof Error ? error.message : error)
    process.exit(1)
  })
