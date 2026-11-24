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
| `maestro` | <modelo-raciocinio> | orquestra; não edita |
| `explorador` | <modelo-barato> | leitura somente leitura |
| `implementador` | <modelo-barato> | edita com diff mínimo |
| `testador` | <modelo-barato> | reproduz falha, roda suíte |
| `documentador` | <modelo-barato> | escreve docs |
| `pesquisador` | <modelo-visao> | acervo, web, imagem/PDF |
| `revisor` | <modelo-pago> | revisão somente leitura |
| `auditor` | <modelo-pago> | segunda opinião |
| `guardiao` | <modelo-raciocinio> | citação, página e garantia |

## Comandos

`/fluxo`, `/revisar`, `/auditar`, `/implementar`, `/pesquisar`, `/garantia`.

## Escalada

Plugin `plugins/escalada`: saldo de falhas por sessão (erro soma, sucesso
desconta). No limite, troca o modelo da sessão.

| Variável | Padrão |
|---|---|
| `MULTIAGENTE_ESCALADA` | ligado (`0` desliga) |
| `MULTIAGENTE_ESCALADA_FALHAS` | `3` |
| `MULTIAGENTE_ESCALADA_MODELO_1` | `<modelo-pago>` |
| `MULTIAGENTE_ESCALADA_MODELO_2` | `<modelo-pago>` |

## Conferir

```powershell
opencode debug agents
opencode debug config
opencode plugin list
```
