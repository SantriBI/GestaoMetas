import { AsyncLocalStorage } from "node:async_hooks"

const storage = new AsyncLocalStorage()

export function runWithDesafiosDbContext(context, callback) {
  return storage.run(context ?? {}, callback)
}

export function getDesafiosDbContext() {
  return storage.getStore() ?? {}
}

export async function queryWithDesafiosDbContext(sql, binds = {}, options = {}) {
  const dbQuery = getDesafiosDbContext().query
  if (!dbQuery) {
    throw new Error("Contexto Oracle da organizacao ausente para o modulo de desafios.")
  }
  return dbQuery(sql, binds, options)
}
