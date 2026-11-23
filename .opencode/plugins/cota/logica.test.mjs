import test from "node:test"
import assert from "node:assert/strict"
import plugin from "./index.ts"
import {
  bloqueadoAte,
  chaveModelo,
  escolherFallback,
  isQuotaError,
  parseFallbacks,
  parseRef,
} from "./logica.mjs"

function ctxFake(salvo = {}) {
  const chamadas = []
  const hooks = {}
  const ctx = {
    chamadas,
    hooks,
    storage: {
      get: async () => salvo,
      set: async (chave, valor) => chamadas.push(["storage", chave, valor]),
    },
    session: {
      hook: async (nome, fn) => {
        hooks[nome] = fn
        return { dispose: async () => {} }
      },
      switchModel: async (input) => chamadas.push(["switchModel", input]),
      synthetic: async (input) => chamadas.push(["synthetic", input.text]),
    },
  }
  return ctx
}

function ambiente(t, env = {}) {
  const chaves = [
    "MULTIAGENTE_COTA",
    "MULTIAGENTE_COTA_FALLBACKS",
    "MULTIAGENTE_COTA_RESERVA",
    "MULTIAGENTE_COTA_COOLDOWN_MS",
  ]
  const anterior = Object.fromEntries(chaves.map((c) => [c, process.env[c]]))
  for (const c of chaves) delete process.env[c]
  Object.assign(process.env, env)
  t.after(() => {
    for (const c of chaves) {
      if (anterior[c] === undefined) delete process.env[c]
      else process.env[c] = anterior[c]
    }
  })
}

const erroCota = { status: 429, type: "provider.rate-limit", message: "rate limit exceeded" }
const modeloPago = { providerID: "opencode", id: "gpt-6-luna" }

test("isQuotaError reconhece 429/402 e mensagens de cota, não erro comum", () => {
  assert.equal(isQuotaError(erroCota), true)
  assert.equal(isQuotaError({ status: 402, message: "payment required" }), true)
  assert.equal(isQuotaError({ message: "daily limit reached" }), true)
  assert.equal(isQuotaError({ message: "Policy budget exceeded" }), true)
  assert.equal(isQuotaError({ message: "tool timeout" }), false)
  assert.equal(isQuotaError(null), false)
})

test("parseFallbacks e escolherFallback respeitam origem, reserva e igualdade", () => {
  const mapa = parseFallbacks(
    "opencode/gpt-6-luna>opencode/hy4-flash-free;invalido;sem-barra>x/y>z",
  )
  assert.equal(mapa.size, 1)
  assert.equal(chaveModelo(escolherFallback(modeloPago, mapa, null)), "opencode/hy4-flash-free")
  assert.equal(
    chaveModelo(escolherFallback({ providerID: "x", id: "y" }, mapa, parseRef("ollama/qwen2.5:7b"))),
    "ollama/qwen2.5:7b",
  )
  const mesmo = parseFallbacks("opencode/gpt-6-luna>opencode/gpt-6-luna")
  assert.equal(escolherFallback(modeloPago, mesmo, null), null)
})

test("escolherFallback ignora um destino já bloqueado e usa a reserva", () => {
  const mapa = parseFallbacks("opencode/gpt-6-luna>opencode/hy4-flash-free")
  const indisponivel = (modelo) => chaveModelo(modelo) !== "opencode/hy4-flash-free"
  const destino = escolherFallback(
    modeloPago,
    mapa,
    parseRef("ollama/qwen2.5:7b"),
    indisponivel,
  )
  assert.equal(chaveModelo(destino), "ollama/qwen2.5:7b")
})

test("retry com cota e fallback: veta retry, troca modelo, avisa e persiste bloqueio", async (t) => {
  ambiente(t, {
    MULTIAGENTE_COTA_FALLBACKS: "opencode/gpt-6-luna>opencode/hy4-flash-free",
    MULTIAGENTE_COTA_COOLDOWN_MS: "1000",
  })
  const ctx = ctxFake()
  await plugin.setup(ctx)

  const evento = {
    sessionID: "s1",
    model: { ...modeloPago },
    error: erroCota,
    attempt: 1,
    decision: { retry: true, delay: 500 },
  }
  await ctx.hooks.retry(evento)

  assert.deepEqual(evento.decision, { retry: false })
  assert.deepEqual(
    ctx.chamadas.find((c) => c[0] === "switchModel"),
    ["switchModel", { sessionID: "s1", model: { providerID: "opencode", id: "hy4-flash-free" } }],
  )
  const aviso = ctx.chamadas.find((c) => c[0] === "synthetic")
  assert.match(aviso[1], /COTA_ESGOTADA/)
  assert.match(aviso[1], /ESTADO: bloqueado/)
  const storage = ctx.chamadas.find((c) => c[0] === "storage")
  assert.equal(storage[1], "cota:bloqueios")
  assert.ok(storage[2]["opencode/gpt-6-luna"] > Date.now())
})

test("retry com cota sem fallback: não troca modelo, mas bloqueia e avisa", async (t) => {
  ambiente(t)
  const ctx = ctxFake()
  await plugin.setup(ctx)

  const evento = {
    sessionID: "s2",
    model: { ...modeloPago },
    error: erroCota,
    decision: { retry: true, delay: 0 },
  }
  await ctx.hooks.retry(evento)

  assert.deepEqual(evento.decision, { retry: false })
  assert.equal(ctx.chamadas.some((c) => c[0] === "switchModel"), false)
  assert.match(ctx.chamadas.find((c) => c[0] === "synthetic")[1], /Sem fallback disponível/)
})

test("retry sem cota não mexe na decisão do OpenCode", async (t) => {
  ambiente(t)
  const ctx = ctxFake()
  await plugin.setup(ctx)

  const evento = {
    sessionID: "s3",
    model: { ...modeloPago },
    error: { type: "tool-error", message: "arquivo não encontrado" },
    decision: { retry: true, delay: 100 },
  }
  await ctx.hooks.retry(evento)

  assert.deepEqual(evento.decision, { retry: true, delay: 100 })
  assert.equal(ctx.chamadas.length, 0)
})

test("model.resolve desvia modelo bloqueado apenas dentro do mesmo provider", async (t) => {
  ambiente(t, {
    MULTIAGENTE_COTA_FALLBACKS: "opencode/gpt-6-luna>opencode/hy4-flash-free",
  })
  const futuro = Date.now() + 60_000
  const ctx = ctxFake({ "opencode/gpt-6-luna": futuro })
  await plugin.setup(ctx)

  const mesmoProvider = { sessionID: "s4", model: { ...modeloPago } }
  ctx.hooks["experimental.model.resolve"](mesmoProvider)
  assert.equal(chaveModelo(mesmoProvider.model), "opencode/hy4-flash-free")

  const outroProvider = { sessionID: "s5", model: { providerID: "nvidia", id: "nemotron" } }
  ctx.hooks["experimental.model.resolve"](outroProvider)
  assert.equal(chaveModelo(outroProvider.model), "nvidia/nemotron")

  assert.ok(bloqueadoAte(new Map([["opencode/gpt-6-luna", futuro]]), modeloPago, Date.now()) > 0)
  assert.equal(bloqueadoAte(new Map([["opencode/gpt-6-luna", 1]]), modeloPago, Date.now()), 0)
})
