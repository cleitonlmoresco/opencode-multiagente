# Ambiente multiagente — referência rápida

- Contrato comum: [`PROTOCOLO_AGENTES.md`](PROTOCOLO_AGENTES.md) — injetado via
  `instructions` **quando o maestro estiver ativado no projeto**.
- Guias completos: [`../docs/COMO_USAR.md`](../docs/COMO_USAR.md),
  [`../docs/ARQUITETURA.md`](../docs/ARQUITETURA.md) e
  [`../docs/PERSONALIZAR.md`](../docs/PERSONALIZAR.md).
- Modelos gratuitos e especializados: [`OPENROUTER_MODELOS.md`](OPENROUTER_MODELOS.md).

## Elenco

| Agente | Modelo | Tarefa |
|---|---|---|
| `maestro` | Nemotron 3 Ultra 550B | orquestra; não edita |
| `explorador` | HY4 Flash | leitura somente leitura |
| `implementador` | DeepSeek V4.1 Flash | edita com diff mínimo |
| `testador` | DeepSeek V4.1 Flash | reproduz falha, roda suíte |
| `documentador` | HY4 Flash | escreve docs |
| `pesquisador` | Nemotron 3.5 Super VL 120B | acervo, web, imagem/PDF |
| `revisor` | GPT-6 Luna (pago) | revisão somente leitura |
| `auditor` | Claude Fable 5.2 (pago) | segunda opinião |
| `guardiao` | Nemotron 3 Ultra 550B | citação, página e garantia |

## Comandos

`/fluxo`, `/revisar`, `/auditar`, `/implementar`, `/pesquisar`, `/garantia`.

## Escalada

Plugin `plugins/escalada`: saldo de falhas por sessão (erro soma, sucesso
desconta). No limite, troca o modelo da sessão.

| Variável | Padrão |
|---|---|
| `MULTIAGENTE_ESCALADA` | ligado (`0` desliga) |
| `MULTIAGENTE_ESCALADA_FALHAS` | `3` |
| `MULTIAGENTE_ESCALADA_MODELO_1` | `opencode/gpt-6-luna` |
| `MULTIAGENTE_ESCALADA_MODELO_2` | `opencode/claude-fable-5-2` |

## Conferir

```powershell
opencode debug agents
opencode debug config
opencode plugin list
```
