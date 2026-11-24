export const PAPEIS = {
  maestro: "raciocinio",
  explorador: "barato",
  implementador: "barato",
  testador: "barato",
  documentador: "barato",
  pesquisador: "visao",
  revisor: "pago",
  auditor: "pago",
  guardiao: "raciocinio",
  title: "barato",
  explore: "barato",
  general: "raciocinio",
  plan: "raciocinio",
}

export function parseRef(texto) {
  if (typeof texto !== "string") return null
  const partes = texto.trim().split("/")
  if (partes.length < 2 || !partes[0]) return null
  return { providerID: partes[0], id: partes.slice(1).join("/") }
}

function gratuito(m) {
  return Array.isArray(m.cost) && m.cost.length > 0 && m.cost.every((c) => c && c.input === 0 && c.output === 0)
}

function comFerramentas(m) {
  return m.capabilities?.tools === true
}

function temVisao(m) {
  const entrada = m.capabilities?.input ?? []
  return Array.isArray(entrada) && entrada.includes("image")
}

function raciocinio(m) {
  return Array.isArray(m.variants) && m.variants.length > 1
}

export function escolherModelo(modelos, papel, config = {}) {
  const fixo = parseRef(config[papel])
  if (fixo) return fixo
  const candidatos = (Array.isArray(modelos) ? modelos : []).filter((m) =>
    m && m.enabled !== false && m.status === "active" && m.type !== "image" &&
    m.type !== "video" && m.type !== "decision" && comFerramentas(m)
  )
  const pontos = (m) => {
    let p = 0
    if (papel === "barato") p += gratuito(m) ? 10 : 0
    if (papel === "pago") p += gratuito(m) ? 0 : 10
    if (papel === "visao") {
      if (temVisao(m)) p += 8
      if (gratuito(m)) p += 3
    }
    if (papel === "raciocinio" && raciocinio(m)) p += 6
    if ((m.limit?.context ?? 0) >= 100000 && papel !== "barato") p += 2
    return p
  }
  candidatos.sort((a, b) => pontos(b) - pontos(a))
  const escolhido = candidatos[0]
  return escolhido ? { providerID: escolhido.providerID, id: escolhido.id } : null
}