/**
 * Roteador de modelos — OpenCode V2.
 * Nenhum ID de modelo ficaversionado. Cada agente recebe um PAPEL; o modelo real
 * vem de ~/.config/opencode/multiagente-modelos.json (opcional, por máquina) ou
 * é descoberto em ctx.model.list() no início da sessão.
 *
 * MULTIAGENTE_ROTEADOR=0 desliga (os agentes herdam o modelo da sessão).
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { PAPEIS, escolherModelo } from "./logica.mjs"

export default {
  id: "roteador",
  async setup(ctx: any) {
    if (process.env.MULTIAGENTE_ROTEADOR === "0") return
    let config: Record<string, string> = {}
    try {
      const arquivo = join(process.env.USERPROFILE ?? "", ".config", "opencode", "multiagente-modelos.json")
      config = JSON.parse(readFileSync(arquivo, "utf8"))
    } catch {
      // sem arquivo local: descoberta automática
    }
    const modelos = await ctx.model.list()
    const resolvidos: Record<string, string> = {}
    await ctx.agent.transform((editor: any) => {
      for (const [agente, papel] of Object.entries(PAPEIS)) {
        const modelo = escolherModelo(modelos, papel, config)
        if (!modelo) continue
        editor.update(agente, (a: any) => { a.model = modelo })
        resolvidos[agente] = `${modelo.providerID}/${modelo.id}`
      }
    })
    console.log("[roteador] modelos resolvidos para", Object.keys(resolvidos).length, "agentes")
  },
}