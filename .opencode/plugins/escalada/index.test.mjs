import test from "node:test"
import assert from "node:assert/strict"
import plugin from "./index.ts"

function ambiente(t, env = {}) {
  const chaves = ["MULTIAGENTE_ESCALADA", "MULTIAGENTE_ESCALADA_FALHAS", "MULTIAGENTE_ESCALADA_MODELO_1", "MULTIAGENTE_ESCALADA_MODELO_2"]
  const anterior = Object.fromEntries(chaves.map((c) => [c, process.env[c]]))
  for (const c of chaves) delete process.env[c]
  Object.assign(process.env, env)
  const erroOriginal = console.error
  console.error = () => {}
  t.after(() => {
    console.error = erroOriginal
    for (const c of chaves) {
      if (anterior[c] === undefined) delete process.env[c]
      else process.env[c] = anterior[c]
    }
  })
}

function ctxFake({ falharSwitch = false, falharSynthetic = false } = {}) {
  const hooks = {}
  const chamadas = []
  return {
    chamadas,
    hooks,
    tool: { hook: async (nome, fn) => { hooks[nome] = fn; return { dispose: async () => {} } } },
    session: {
      hook: async (nome, fn) => { hooks[nome] = fn; return { dispose: async () => {} } },
      switchModel: async (input) => {
        chamadas.push(["switchModel", input])
        if (falharSwitch) throw new Error("switch falhou")
      },
      synthetic: async (input) => {
        chamadas.push(["synthetic", input.text])
        if (falharSynthetic) throw new Error("synthetic falhou")
      },
    },
  }
}

const erroFerramenta = { sessionID: "s1", status: "error", tool: "read" }

test("escalada: switchModel falha não incrementa o nível", async (t) => {
  ambiente(t, { MULTIAGENTE_ESCALADA_FALHAS: "2" })
  const ctx = ctxFake({ falharSwitch: true })
  await plugin.setup(ctx)
  for (let i = 0; i < 4; i++) await ctx.hooks["execute.after"](erroFerramenta)
  const alvos = ctx.chamadas.filter((c) => c[0] === "switchModel").map((c) => c[1].model)
  assert.equal(alvos.length, 2)
  assert.deepEqual(alvos[0], { providerID: "opencode", id: "gpt-6-luna" })
  assert.deepEqual(alvos[1], { providerID: "opencode", id: "gpt-6-luna" })
  const aviso = ctx.chamadas.find((c) => c[0] === "synthetic")
  assert.match(aviso[1], /Falha ao elevar para opencode\/gpt-6-luna/)
})

test("escalada: synthetic falha, mas o nível incrementa", async (t) => {
  ambiente(t, { MULTIAGENTE_ESCALADA_FALHAS: "2" })
  const ctx = ctxFake({ falharSynthetic: true })
  await plugin.setup(ctx)
  for (let i = 0; i < 4; i++) await ctx.hooks["execute.after"](erroFerramenta)
  const alvos = ctx.chamadas.filter((c) => c[0] === "switchModel").map((c) => c[1].model)
  assert.deepEqual(alvos[0], { providerID: "opencode", id: "gpt-6-luna" })
  assert.deepEqual(alvos[1], { providerID: "opencode", id: "claude-fable-5-2" })
})

test("escalada: caminho feliz registra nível 1/2", async (t) => {
  ambiente(t, { MULTIAGENTE_ESCALADA_FALHAS: "2" })
  const ctx = ctxFake()
  await plugin.setup(ctx)
  await ctx.hooks["execute.after"](erroFerramenta)
  await ctx.hooks["execute.after"](erroFerramenta)
  const sintetico = ctx.chamadas.find((c) => c[0] === "synthetic")
  assert.match(sintetico[1], /nível 1\/2/)
})