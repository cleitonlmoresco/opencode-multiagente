/**
 * Escalada automática de modelo — OpenCode V2.
 *
 * Mantém um saldo de falhas de ferramenta por sessão: erro soma 1, sucesso
 * desconta 1. Quando o saldo chega ao limite (MULTIAGENTE_ESCALADA_FALHAS,
 * padrão 3), troca o modelo da sessão para o próximo nível, zera o saldo e
 * deixa um aviso sintético. A sessão não volta de nível sozinha — use `/new`
 * ou troque o modelo manualmente.
 *
 * Desligue com MULTIAGENTE_ESCALADA=0.
 * Modelos: MULTIAGENTE_ESCALADA_MODELO_1 e MULTIAGENTE_ESCALADA_MODELO_2
 * (formato provider/modelo).
 */

type ModelRef = { providerID: string; id: string }

function lerModelo(chave: string, padrao: string): ModelRef {
  const bruto = (process.env[chave] ?? padrao).trim()
  const corte = bruto.indexOf("/")
  if (corte <= 0) return { providerID: "opencode", id: "gpt-6-luna" }
  return { providerID: bruto.slice(0, corte), id: bruto.slice(corte + 1) }
}

const NIVEIS: ModelRef[] = [
  lerModelo("MULTIAGENTE_ESCALADA_MODELO_1", "opencode/gpt-6-luna"),
  lerModelo("MULTIAGENTE_ESCALADA_MODELO_2", "opencode/claude-fable-5-2"),
]

function limite(): number {
  const n = Number(process.env.MULTIAGENTE_ESCALADA_FALHAS ?? "3")
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 3
}

export default {
  id: "escalada",
  async setup(ctx: any) {
    if (process.env.MULTIAGENTE_ESCALADA === "0") return

    const saldo = new Map<string, number>()
    const nivel = new Map<string, number>()

    const elevar = async (sessionID: string, total: number) => {
      const atual = nivel.get(sessionID) ?? 0
      if (atual >= NIVEIS.length) return
      const proximo = atual + 1
      const alvo = NIVEIS[proximo - 1]
      nivel.set(sessionID, proximo)
      try {
        await ctx.session.switchModel({ sessionID, model: alvo })
        await ctx.session.synthetic({
          sessionID,
          text:
            `[escalada] saldo de ${total} falhas de ferramenta. ` +
            `Modelo elevado para ${alvo.providerID}/${alvo.id} ` +
            `(nível ${proximo}/${NIVEIS.length}).`,
        })
      } catch (erro) {
        console.error("[escalada] não foi possível elevar o modelo:", erro)
      }
    }

    try {
      await ctx.tool.hook("execute.after", async (event: any) => {
        const sessionID = event?.sessionID ?? event?.session?.id
        if (!sessionID) return

        if (event?.status === "completed") {
          saldo.set(sessionID, Math.max(0, (saldo.get(sessionID) ?? 0) - 1))
          return
        }

        if (event?.status !== "error") return
        if (event?.tool === "question") return

        const total = (saldo.get(sessionID) ?? 0) + 1
        if (total >= limite()) {
          saldo.set(sessionID, 0)
          await elevar(sessionID, total)
          return
        }
        saldo.set(sessionID, total)
      })
    } catch (erro) {
      console.error("[escalada] hook de ferramenta indisponível:", erro)
    }

    try {
      await ctx.session.hook("prompt", (event: any) => {
        const sessionID = event?.sessionID ?? event?.session?.id
        if (sessionID) saldo.set(sessionID, 0)
      })
    } catch (erro) {
      console.error("[escalada] hook de prompt indisponível:", erro)
    }
  },
}
