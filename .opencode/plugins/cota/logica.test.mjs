import test from "node:test"
import assert from "node:assert/strict"
import plugin from "./index.ts"
import {
  bloqueadoAte,
  chaveModelo,
  escolherFallback,
  escolherModeloAutomatico,
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
const modeloPago = { providerID: "teste", id: "pago" }

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
    "teste/pago>teste/gratuito;invalido;sem-barra>x/y>z",
  )
  assert.equal(mapa.size, 1)
  assert.equal(chaveModelo(escolherFallback(modeloPago, mapa, null)), "teste/gratuito")
  assert.equal(
    chaveModelo(escolherFallback({ providerID: "x", id: "y" }, mapa, parseRef("teste/reserva"))),
    "teste/reserva",
  )
  const mesmo = parseFallbacks("teste/pago>teste/pago")
  assert.equal(escolherFallback(modeloPago, mesmo, null), null)
})

test("escolherFallback ignora um destino já bloqueado e usa a reserva", () => {
  const mapa = parseFallbacks("teste/pago>teste/gratuito")
  const indisponivel = (modelo) => chaveModelo(modelo) !== "teste/gratuito"
  const destino = escolherFallback(
    modeloPago,
    mapa,
    parseRef("teste/reserva"),
    indisponivel,
  )
  assert.equal(chaveModelo(destino), "teste/reserva")
})

test("retry com cota e fallback: veta retry, troca modelo, avisa e persiste bloqueio", async (t) => {
  ambiente(t, {
    MULTIAGENTE_COTA_FALLBACKS: "teste/pago>teste/gratuito",
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
    ["switchModel", { sessionID: "s1", model: { providerID: "teste", id: "gratuito" } }],
  )
  const aviso = ctx.chamadas.find((c) => c[0] === "synthetic")
  assert.match(aviso[1], /COTA_ESGOTADA/)
  assert.match(aviso[1], /ESTADO: bloqueado/)
  const storage = ctx.chamadas.find((c) => c[0] === "storage")
  assert.equal(storage[1], "cota:bloqueios")
  assert.ok(storage[2]["teste/pago"] > Date.now())
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
    MULTIAGENTE_COTA_FALLBACKS: "teste/pago>teste/gratuito",
  })
  const futuro = Date.now() + 60_000
  const ctx = ctxFake({ "teste/pago": futuro })
  await plugin.setup(ctx)

  const mesmoProvider = { sessionID: "s4", model: { ...modeloPago } }
  ctx.hooks["experimental.model.resolve"](mesmoProvider)
  assert.equal(chaveModelo(mesmoProvider.model), "teste/gratuito")

  const outroProvider = { sessionID: "s5", model: { providerID: "teste", id: "outro" } }
  ctx.hooks["experimental.model.resolve"](outroProvider)
  assert.equal(chaveModelo(outroProvider.model), "teste/outro")

  assert.ok(bloqueadoAte(new Map([["teste/pago", futuro]]), modeloPago, Date.now()) > 0)
  assert.equal(bloqueadoAte(new Map([["teste/pago", 1]]), modeloPago, Date.now()), 0)
})

test("retry com cota e falha no switchModel: aviso específico, sem 'Sem fallback'", async (t) => {
  ambiente(t, { MULTIAGENTE_COTA_FALLBACKS: "teste/pago>teste/gratuito" })
  const hooks = {}
  const chamadas = []
  const ctx = {
    storage: {
      get: async () => ({}),
      set: async (chave, valor) => chamadas.push(["storage", chave, valor]),
    },
    session: {
      hook: async (nome, fn) => { hooks[nome] = fn; return { dispose: async () => {} } },
      switchModel: async () => { throw new Error("switch falhou") },
      synthetic: async (input) => chamadas.push(["synthetic", input.text]),
    },
  }
  await plugin.setup(ctx)
  const evento = {
    sessionID: "s9",
    model: { ...modeloPago },
    error: erroCota,
    decision: { retry: true, delay: 0 },
  }
  await hooks.retry(evento)
  assert.deepEqual(evento.decision, { retry: false })
  const avisos = chamadas.filter((c) => c[0] === "synthetic").map((c) => c[1])
  assert.equal(avisos.length, 1)
  assert.match(avisos[0], /Falha ao trocar para teste\/gratuito/)
  assert.match(avisos[0], /switch falhou/)
  assert.doesNotMatch(avisos[0], /Sem fallback disponível/)
  const storage = chamadas.find((c) => c[0] === "storage")
  assert.ok(storage[2]["teste/pago"] > Date.now())
})
test("isQuotaError cobre mensagens de credito e limite gratuito", () => {
  assert.equal(isQuotaError({ message: "Free usage limit reached" }), true)
  assert.equal(isQuotaError({ message: "Insufficient balance" }), true)
  assert.equal(isQuotaError({ message: "Please top up your account" }), true)
  assert.equal(isQuotaError({ message: "arquivo não encontrado" }), false)
})

test("escolherModeloAutomatico prefere gratuito e outro provider, ignora bloqueado", () => {
  const modelos = [
    { providerID: "teste", id: "pago", cost: [{ input: 1, output: 2 }], enabled: true, status: "active", capabilities: { tools: true } },
    { providerID: "teste", id: "gratuito", cost: [{ input: 0, output: 0 }], enabled: true, status: "active", capabilities: { tools: true } },
    { providerID: "outro", id: "alternativo", cost: [{ input: 0, output: 0 }], enabled: true, status: "active", capabilities: { tools: true } },
    { providerID: "bloqueio", id: "bloqueado", cost: [{ input: 0, output: 0 }], enabled: true, status: "active", capabilities: { tools: true } },
  ]
  const bloqueios = new Map([["bloqueio/bloqueado", Date.now() + 60_000]])
  const escolhido = escolherModeloAutomatico(
    modelos,
    { providerID: "teste", id: "pago" },
    bloqueios,
  )
  assert.equal(chaveModelo(escolhido), "outro/alternativo")
})

test("retry sem fallback configurado usa alternativa automatica", async (t) => {
  ambiente(t)
  const hooks = {}
  const chamadas = []
  const ctx = {
    storage: { get: async () => ({}), set: async () => {} },
    model: {
      list: async () => [
        { providerID: "outro", id: "alternativo", cost: [{ input: 0, output: 0 }], enabled: true, status: "active", capabilities: { tools: true } },
      ],
    },
    session: {
      hook: async (nome, fn) => { hooks[nome] = fn; return { dispose: async () => {} } },
      switchModel: async (input) => chamadas.push(["switchModel", input]),
      synthetic: async (input) => chamadas.push(["synthetic", input.text]),
    },
  }
  await plugin.setup(ctx)
  const evento = {
    sessionID: "s10",
    model: { ...modeloPago },
    error: { message: "Free usage limit reached" },
    decision: { retry: true, delay: 0 },
  }
  await hooks.retry(evento)
  assert.deepEqual(evento.decision, { retry: false })
  const troca = chamadas.find((c) => c[0] === "switchModel")
  assert.deepEqual(troca[1].model, { providerID: "outro", id: "alternativo" })
  assert.match(chamadas.find((c) => c[0] === "synthetic")[1], /Modelo da sessão trocado para outro\/alternativo/)
})