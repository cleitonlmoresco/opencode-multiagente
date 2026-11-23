/**
 * Fallback por cota — OpenCode V2.
 *
 * Detecta falha de modelo/provedor por limite diário (429, 402 ou mensagem de
 * rate limit/quota), barra o retry para não formar storm, bloqueia o modelo por
 * um cooldown persistido e troca a sessão para um fallback configurado.
 *
 * Diferente do plugin `escalada`, isto NÃO é falha de ferramenta e NÃO sobe de
 * nível: é uma queda controlada para um modelo disponível, ou bloqueio explícito
 * quando não há para onde ir.
 *
 * MULTIAGENTE_COTA=0 desliga.
 * MULTIAGENTE_COTA_FALLBACKS="de/para;de/para" (padrão: vazio)
 * MULTIAGENTE_COTA_RESERVA="provider/modelo" (padrão: vazio)
 * MULTIAGENTE_COTA_COOLDOWN_MS=86400000 (padrão: 24h)
 */
import {
  bloqueadoAte,
  chaveModelo,
  escolherFallback,
  isQuotaError,
  parseFallbacks,
  parseRef,
} from "./logica.mjs"

type ModelRef = { providerID: string; id: string }

const CHAVE_STORAGE = "cota:bloqueios"
const COOLDOWN_PADRAO = 86_400_000

function cooldown(): number {
  const n = Number(process.env.MULTIAGENTE_COTA_COOLDOWN_MS ?? String(COOLDOWN_PADRAO))
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : COOLDOWN_PADRAO
}

export default {
  id: "cota",
  async setup(ctx: any) {
    if (process.env.MULTIAGENTE_COTA === "0") return

    const fallbacks = parseFallbacks(process.env.MULTIAGENTE_COTA_FALLBACKS)
    const reserva = parseRef(process.env.MULTIAGENTE_COTA_RESERVA ?? "")
    const ms = cooldown()
    const bloqueios = new Map<string, number>()

    try {
      const salvo = await ctx.storage.get(CHAVE_STORAGE)
      if (salvo && typeof salvo === "object") {
        for (const [chave, ate] of Object.entries(salvo as Record<string, unknown>)) {
          if (typeof ate === "number" && Number.isFinite(ate)) bloqueios.set(chave, ate)
        }
      }
    } catch (erro) {
      console.error("[cota] não foi possível ler bloqueios:", erro)
    }

    const salvar = async () => {
      try {
        await ctx.storage.set(CHAVE_STORAGE, Object.fromEntries(bloqueios))
      } catch (erro) {
        console.error("[cota] não foi possível salvar bloqueios:", erro)
      }
    }

    const avisar = async (sessionID: string, texto: string) => {
      try {
        await ctx.session.synthetic({ sessionID, text: texto })
      } catch (erro) {
        console.error("[cota] não foi possível avisar a sessão:", erro)
      }
    }

    const registros: Array<{ dispose(): Promise<void> }> = []

    registros.push(await ctx.session.hook("retry", async (event: any) => {
      if (!event?.error || !isQuotaError(event.error)) return
      const modelo: ModelRef | undefined = event.model
      if (!modelo?.providerID || !modelo?.id) return

      const chave = chaveModelo(modelo)
      const ate = Date.now() + ms
      bloqueios.set(chave, ate)
      await salvar()

      // A cota não volta com retry imediato: isto evita storm de 429.
      event.decision = { retry: false }

      const disponivel = (candidato: ModelRef) => !bloqueadoAte(bloqueios, candidato, Date.now())
      const destino = escolherFallback(modelo, fallbacks, reserva, disponivel)
      const ateISO = new Date(ate).toISOString()

      if (destino) {
        try {
          await ctx.session.switchModel({ sessionID: event.sessionID, model: destino })
          await avisar(
            event.sessionID,
            `[cota] COTA_ESGOTADA em ${chave}. Modelo da sessão trocado para ` +
              `${chaveModelo(destino)}. Registre ESTADO: bloqueado no RELATÓRIO se a ` +
              `tarefa não pôde ser concluída; não tente ${chave} antes de ${ateISO}.`,
          )
          return
        } catch (erro) {
          console.error("[cota] não foi possível trocar o modelo:", erro)
        }
      }

      await avisar(
        event.sessionID,
        `[cota] COTA_ESGOTADA em ${chave}. Sem fallback disponível; tarefa ` +
          `bloqueada até ${ateISO}. Registre ESTADO: bloqueado no RELATÓRIO.`,
      )
    }))

    try {
      // experimental.model.resolve só aceita modelo do MESMO provider.
      registros.push(await ctx.session.hook("experimental.model.resolve", (event: any) => {
        const atual: ModelRef | undefined = event?.model
        if (!atual?.providerID || !atual?.id) return
        if (!bloqueadoAte(bloqueios, atual, Date.now())) return
        const disponivel = (candidato: ModelRef) => !bloqueadoAte(bloqueios, candidato, Date.now())
        const destino = escolherFallback(atual, fallbacks, reserva, disponivel)
        if (destino && destino.providerID === atual.providerID) event.model = destino
      }))
    } catch (erro) {
      console.error("[cota] hook de resolução indisponível:", erro)
    }

    return async () => {
      for (const registro of registros) await registro.dispose()
    }
  },
}
