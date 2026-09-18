// Cria (ou atualiza a senha de) o usuario central com role INGRED (Secretaria Executiva),
// que so enxerga o Painel de Acessos (/admin/painel-acessos).
// Uso: node scripts/create-ingred-user.js <login> <senha> ["Nome completo"]
import "../src/config/env.js"
import bcrypt from "bcrypt"
import centralPool from "../src/db/mysql.js"

const [login, senha, nome] = process.argv.slice(2)

if (!login || !senha) {
  console.error("Uso: node scripts/create-ingred-user.js <login> <senha> [\"Nome completo\"]")
  process.exit(1)
}

const hash = await bcrypt.hash(senha, 10)
const nomeFinal = nome ?? "Ingred"

const [existing] = await centralPool.query(
  "SELECT id_usuario FROM usuarios_auth WHERE login = ? LIMIT 1",
  [login]
)

if (existing.length) {
  await centralPool.query(
    "UPDATE usuarios_auth SET senha_hash = ?, role = 'INGRED', nome = ?, nome_completo = ?, ativo = 'S', senha_temporaria = 'N', token_version = token_version + 1 WHERE id_usuario = ?",
    [hash, nomeFinal, nomeFinal, existing[0].id_usuario]
  )
  console.log(`Usuario INGRED atualizado: login=${login} id_usuario=${existing[0].id_usuario}`)
} else {
  const [result] = await centralPool.query(
    "INSERT INTO usuarios_auth (login, senha_hash, role, nome, nome_completo, ativo, senha_temporaria) VALUES (?, ?, 'INGRED', ?, ?, 'S', 'N')",
    [login, hash, nomeFinal, nomeFinal]
  )
  console.log(`Usuario INGRED criado: login=${login} id_usuario=${result.insertId}`)
}

process.exit(0)
