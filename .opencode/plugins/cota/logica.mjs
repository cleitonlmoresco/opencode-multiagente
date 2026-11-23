const STATUS_COTA = new Set([402, 429])
const PADRAO_COTA = /rate.?limit|quota|daily limit|usage limit|too many requests|budget exceeded|resource_exhausted|insufficient (credits|quota|balance)|exceeded your|no credit|top up|billing/i

export function parseRef(texto) {
  if (typeof texto !== "string") return null
  const bruto = texto.trim()
  const corte = bruto.indexOf("/")
  if (corte <= 0 || corte === bruto.length - 1) return null
  return { providerID: bruto.slice(0, corte), id: bruto.slice(corte + 1) }
}

export function chaveModelo(modelo) {
  return `${modelo.providerID}/${modelo.id}`
}

export function parseFallbacks(raw) {
  const mapa = new Map()
  if (!raw) return mapa
  for (const par of String(raw).split(";")) {
    if (!par.trim()) continue
    const [de, para] = par.split(">")
    const origem = parseRef(de)
    const destino = parseRef(para)
    if (origem && destino) mapa.set(chaveModelo(origem), destino)
  }
  return mapa
}

export function isQuotaError(erro) {
  if (!erro || typeof erro !== "object") return false
  if (STATUS_COTA.has(erro.status)) return true
  const texto = `${erro.type ?? ""} ${erro.message ?? ""}`
  return PADRAO_COTA.test(texto)
}

export function escolherFallback(modelo, fallbacks, reserva, disponivel = () => true) {
  const chave = chaveModelo(modelo)
  const candidatos = [fallbacks?.get(chave), reserva].filter(Boolean)
  const destino = candidatos.find((c) => chaveModelo(c) !== chave && disponivel(c))
  return destino ?? null
}

export function bloqueadoAte(bloqueios, modelo, agora) {
  const ate = bloqueios?.get(chaveModelo(modelo))
  return typeof ate === "number" && ate > agora ? ate : 0
}
export function escolherModeloAutomatico(modelos, atual, bloqueios = new Map(), agora = Date.now()) {
  const chaveAtual = chaveModelo(atual)
  const candidatos = (Array.isArray(modelos) ? modelos : []).filter((m) =>
    m && m.enabled !== false && m.status !== 'disabled' &&
    (m.type === undefined || m.type === 'chat') &&
    m.capabilities?.tools !== false &&
    chaveModelo(m) !== chaveAtual &&
    !bloqueadoAte(bloqueios, m, agora)
  )
  const gratuito = (m) => Array.isArray(m.cost) && m.cost.some((c) => c && c.input === 0 && c.output === 0)
  const outroProvider = (m) => m.providerID !== atual.providerID
  candidatos.sort((a, b) => {
    const ga = gratuito(a) ? 0 : 1
    const gb = gratuito(b) ? 0 : 1
    if (ga !== gb) return ga - gb
    const pa = outroProvider(a) ? 0 : 1
    const pb = outroProvider(b) ? 0 : 1
    return pa - pb
  })
  const escolhido = candidatos[0]
  return escolhido ? { providerID: escolhido.providerID, id: escolhido.id } : null
}