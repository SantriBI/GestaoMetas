import mysql from "mysql2/promise"

// Segunda rodada do de-para da FACHI (org 22): audit-sk-vendedor-oracle-direto.js --org=22
// mostrou que 4 dos 8 logins corrigidos em fix-sk-vendedor-fachi.js reverteram sozinhos pro
// SK_VENDEDOR antigo (empresa 461, sem receita), mais 1 vendedor novo (MATHEUS RAK) que ja
// nasceu cadastrado com o codigo errado, e 1 ajuste de baixo impacto (ANGELICA VIEIRA).
// So estes 6 - os demais (EVERTON, ITAMAR, DAIANE, RUBEM, PAOLA) ja estao corretos.

const UPDATES = [
  { id_usuario: 11, nome: "JONE DUARTE", de: 8161, para: 8438 },
  { id_usuario: 9, nome: "JEAN RODRIGUES", de: 8274, para: 8437 },
  { id_usuario: 12, nome: "MATHEUS RAK", de: 8164, para: 8440 },
  { id_usuario: 6, nome: "VIVIANE OLIVEIRA", de: 8172, para: 8445 },
  { id_usuario: 10, nome: "DENISE SILVA", de: 8354, para: 8434 },
  { id_usuario: 7, nome: "ANGELICA VIEIRA", de: 8314, para: 8454 },
]

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.TENANT_DATABASE,
  })

  await conn.beginTransaction()
  try {
    for (const u of UPDATES) {
      const [result] = await conn.query(
        "UPDATE usuarios_auth SET sk_vendedor = ? WHERE id_usuario = ? AND sk_vendedor = ?",
        [u.para, u.id_usuario, u.de]
      )
      console.log(`${u.nome} (id_usuario=${u.id_usuario}): ${u.de} -> ${u.para} | affectedRows=${result.affectedRows}`)
      if (result.affectedRows !== 1) {
        throw new Error(`Esperava 1 linha afetada para id_usuario=${u.id_usuario}, veio ${result.affectedRows}. Abortando (rollback).`)
      }
    }
    await conn.commit()
    console.log("\nCOMMIT ok.")
  } catch (err) {
    await conn.rollback()
    console.error("\nROLLBACK - nada foi alterado.", err.message)
    throw err
  }

  const [check] = await conn.query(
    "SELECT id_usuario, nome, sk_vendedor FROM usuarios_auth WHERE id_usuario IN (?, ?, ?, ?, ?, ?) ORDER BY id_usuario",
    UPDATES.map((u) => u.id_usuario)
  )
  console.log("\nEstado final:")
  console.table(check)

  await conn.end()
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
