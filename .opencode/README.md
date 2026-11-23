# Ambiente multiagente

Um maestro (primary) decompõe o pedido e delega para especialistas (subagents),
cada um com modelo e fronteira próprios. O contrato comum está em
`PROTOCOLO_AGENTES.md`, injetado em toda sessão via `instructions`.

## Elenco

| Agente | Modelo | Tarefa |
|---|---|---|
| `maestro` | Nemotron 3 Ultra 550B (grátis) | orquestra, cobra protocolo, não edita |
| `explorador` | HY4 Flash (grátis) | busca e leitura somente leitura |
| `implementador` | DeepSeek V4.1 Flash free | edita código com diff mínimo |
| `testador` | DeepSeek V4.1 Flash free | reproduz falha, roda suíte, edita `tests/**` |
| `documentador` | HY4 Flash (grátis) | escreve docs, não edita `.py` |
| `pesquisador` | Nemotron 3.5 Super VL 120B (grátis) | acervo, web, imagem/PDF |
| `revisor` | GPT-6 Luna (pago) | revisão de diff, somente leitura |
| `auditor` | Claude Fable 5.2 (pago) | segunda opinião e risco alto |
| `guardiao` | Nemotron 3 Ultra 550B (grátis) | confere citação, página e garantia |

## Como usar

- `/fluxo <objetivo>` — pipeline completo: explorar → implementar → testar →
  revisar.
- `/revisar <alvo>` — revisor pago.
- `/auditar <alvo>` — auditor pago forte.
- `/implementar <tarefa>` — implementação direta.
- `/pesquisar <pergunta>` — acervo + web + visão.
- `/garantia <texto>` — auditoria de proveniência.

Sessão nova começa no `maestro` (`default_agent`). Para falar com um
especialista específico, peça pelo nome no prompt; o maestro lança o subagente.
Para trocar o modelo da sessão, use `/model`.

## Escalada automática

O plugin `.opencode/plugins/escalada/index.ts` mantém um saldo de falhas de
ferramenta por sessão. Ao chegar em 3 (um sucesso desconta uma), ele troca o
modelo da sessão para `opencode/gpt-6-luna`; na próxima rodada de 3, para
`opencode/claude-fable-5-2`.

- Desligar: `PEPERTILO_ESCALADA=0` no ambiente do servidor.
- Limite: `PEPERTILO_ESCALADA_FALHAS` (padrão 3).
- Modelos: `PEPERTILO_ESCALADA_MODELO_1` e `PEPERTILO_ESCALADA_MODELO_2`
  (`provider/modelo`).

A sessão não volta de nível sozinha; use `/new` ou troque o modelo na mão.

## OpenRouter

Os IDs e a função de cada modelo estão em `OPENROUTER_MODELOS.md`. O provider
`openrouter` já aparece em `opencode models`, mas requer credencial:

```powershell
opencode auth login openrouter
# ou defina OPENROUTER_API_KEY no ambiente do servidor
```

Modelos de chat/tool calling adicionados ao seletor:

- `openrouter/google/gemma-4-31b-it:free`
- `openrouter/google/gemma-4-26b-a4b-it:free`
- `openrouter/liquid/lfm-3-1.7b:free`
- `openrouter/openrouter/free`

Embeddings, reranker, TTS e geração de imagem estão documentados, mas não entram
no seletor de chat do OpenCode: são endpoints especializados para os pipelines.

## Conferir

```powershell
opencode debug agents
opencode debug config
opencode models | Select-String openrouter
```
