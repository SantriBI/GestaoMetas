import mysql from "mysql2/promise"

// Aplica o de-para levantado pela auditoria (audit-sk-vendedor-oracle-direto.js) para
// usuarios_auth.sk_vendedor da FACHI (org 22): 8 logins ainda apontavam pro SK_VENDEDOR
// da empresa antiga (461, "fora de uso"), quando a venda real agora acontece na empresa
// nova (481). So estes 8 - os demais ja estavam corretos ou nao tem par em 481.

const UPDATES = [
  { id_usuario: 1, nome: "EVERTON LOPES", de: 8157, para: 8435 },
  { id_usuario: 8, nome: "ITAMAR FARIAS", de: 8159, para: 8436 },
  { id_usuario: 11, nome: "JONE DUARTE", de: 8161, para: 8438 },
  { id_usuario: 9, nome: "JEAN RODRIGUES", de: 8274, para: 8437 },
  { id_usuario: 6, nome: "VIVIANE OLIVEIRA", de: 8172, para: 8445 },
  { id_usuario: 2, nome: "VANESSA MELO", de: 8294, para: 8443 },
  { id_usuario: 3, nome: "RUBEM JUNIOR", de: 8334, para: 8442 },
  { id_usuario: 10, nome: "DENISE SILVA", de: 8354, para: 8434 },
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
    "SELECT id_usuario, nome, sk_vendedor FROM usuarios_auth WHERE id_usuario IN (?, ?, ?, ?, ?, ?, ?, ?) ORDER BY id_usuario",
    UPDATES.map((u) => u.id_usuario)
  )
  console.log("\nEstado final:")
  console.table(check)

  await conn.end()
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
