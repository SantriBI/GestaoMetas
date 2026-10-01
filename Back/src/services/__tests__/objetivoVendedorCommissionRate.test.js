import { test } from "node:test"
import assert from "node:assert/strict"
import { normalizeCommissionRate } from "../objetivoVendedorService.js"

test("PERCENTUAL_COMISSAO abaixo de 1 e percentual, nao taxa direta", () => {
  assert.equal(normalizeCommissionRate(0.8127), 0.008127)
})

test("PERCENTUAL_COMISSAO acima de 1 tambem e dividido por 100", () => {
  assert.equal(normalizeCommissionRate(3.5), 0.035)
  assert.equal(normalizeCommissionRate(1.4556), 0.014556)
})

test("PERCENTUAL_COMISSAO zero, negativo ou ausente devolve null (cai no fallback de 3%)", () => {
  assert.equal(normalizeCommissionRate(0), null)
  assert.equal(normalizeCommissionRate(-1), null)
  assert.equal(normalizeCommissionRate(null), null)
  assert.equal(normalizeCommissionRate(undefined), null)
})
