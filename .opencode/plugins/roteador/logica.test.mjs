import test from "node:test"
import assert from "node:assert/strict"
import { PAPEIS, escolherModelo } from "./logica.mjs"

const modelos = [
  { providerID: "a", id: "free", cost: [{ input: 0, output: 0 }], status: "active", enabled: true, capabilities: { tools: true }, limit: { context: 8000 }, variants: [] },
  { providerID: "b", id: "paid", cost: [{ input: 1, output: 2 }], status: "active", enabled: true, capabilities: { tools: true, input: ["text", "image"] }, limit: { context: 200000 }, variants: [{ id: "high" }, { id: "max" }] },
  { providerID: "c", id: "visao", cost: [{ input: 0, output: 0 }], status: "active", enabled: true, capabilities: { tools: true, input: ["text", "image"] }, limit: { context: 32000 }, variants: [] },
]

test("papel barato prefere gratuito", () => {
  assert.equal(escolherModelo(modelos, "barato").id, "free")
})
test("papel pago prefere nao gratuito", () => {
  assert.equal(escolherModelo(modelos, "pago").id, "paid")
})
test("papel visao prefere modelo com imagem", () => {
  assert.equal(escolherModelo(modelos, "visao").id, "visao")
})
test("papel raciocinio prefere variantes de esforco", () => {
  assert.equal(escolherModelo(modelos, "raciocinio").id, "paid")
})
test("config local tem prioridade", () => {
  assert.deepEqual(escolherModelo(modelos, "pago", { pago: "x/y" }), { providerID: "x", id: "y" })
})
test("todo agente tem papel", () => {
  for (const a of ["maestro", "explorador", "implementador", "testador", "documentador", "pesquisador", "revisor", "auditor", "guardiao"]) {
    assert.ok(PAPEIS[a], `papel ausente: ${a}`)
  }
})