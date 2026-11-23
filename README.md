# opencode-multiagente

Roster de agentes para o **OpenCode V2**: um maestro decompõe o pedido e delega
para especialistas, cada um com modelo e fronteira próprios. O pacote inclui o
contrato de handoff, a escada de modelos por custo, comandos prontos e um plugin
de escalada automática por falhas de ferramenta.

Sem chave, token ou caminho pessoal versionado aqui. A autenticação fica no
OpenCode (`opencode auth login`) ou em variáveis de ambiente.

## Por que usar

- **Uma língua só**: todos os agentes seguem o mesmo contrato de prova e
  relatório.
- **Custo sob controle**: tarefa mecânica em modelo grátis; modelo pago só para
  revisão, auditoria e risco alto.
- **Fronteiras claras**: quem edita não revisa; quem revisa não edita; quem
  pesquisa não promove achado a verdade.
- **Escalada automática**: falha repetida de ferramenta sobe o modelo sozinha,
  sem você perceber no meio da tarefa.
- **Portátil**: é só uma pasta `.opencode/` mais um `opencode.example.json` (copie para `opencode.json` no projeto).

## Arquitetura

```text
                 ┌───────────────────────────────┐
   você ───────▶ │ maestro (primary)             │
                 │ classifica, delega, consolida │
                 └──────┬───────────────┬────────┘
                        │               │
             ┌──────────▼──┐     ┌──────▼─────────┐
             │ explorador  │     │ implementador  │
             │ só leitura  │     │ diff mínimo    │
             └─────────────┘     └──────┬─────────┘
                                        │
                                 ┌──────▼─────────┐
                                 │ testador       │
                                 │ reproduz/prova │
                                 └──────┬─────────┘
                                        │
                                 ┌──────▼─────────┐
                                 │ revisor        │
                                 │ auditor        │
                                 └────────────────┘
```

O fluxo completo está em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md). O uso no
dia a dia está em [`docs/COMO_USAR.md`](docs/COMO_USAR.md). Para trocar modelos
e criar agentes, veja [`docs/PERSONALIZAR.md`](docs/PERSONALIZAR.md).

## Requisitos

- OpenCode **v2.2.5** ou superior
- Pelo menos um provider autenticado (`opencode auth list`)
- Os modelos citados disponíveis na sua conta — ajuste os IDs se necessário

## Instalação

1. Copie a pasta `.opencode/` para a raiz do projeto.
2. Copie `opencode.example.json` para `opencode.json` e mescle com a
   configuração que já existir.
3. Abra uma sessão nova (`/new`). O rodapé deve mostrar `maestro · <modelo>`.

```powershell
Copy-Item .opencode <destino> -Recurse
Copy-Item opencode.example.json <destino>\opencode.json
```

O `.opencode/` é **project-scoped**: só vale na pasta onde foi instalado. Para
usar em todos os projetos, copie os mesmos arquivos para `~/.config/opencode/` e
registre `instructions` e `default_agent` no `opencode.jsonc` global.

## Elenco

| Agente | Modelo de referência | Papel |
|---|---|---|
| `maestro` | Nemotron 3 Ultra 550B | orquestra, delega, cobra o protocolo; não edita |
| `explorador` | HY4 Flash | busca e leitura somente leitura |
| `implementador` | DeepSeek V4.1 Flash | edita código com diff mínimo |
| `testador` | DeepSeek V4.1 Flash | reproduz falha, roda suíte, edita `tests/**` |
| `documentador` | HY4 Flash | escreve documentação; não edita código |
| `pesquisador` | Nemotron 3.5 Super VL 120B | acervo, web, imagem/PDF |
| `revisor` | GPT-6 Luna (pago) | revisão de diff, somente leitura |
| `auditor` | Claude Fable 5.2 (pago) | segunda opinião e risco alto |
| `guardiao` | Nemotron 3 Ultra 550B | confere citação, página e garantia |

Os modelos são o ponto de partida. Troque os IDs em `.opencode/agents/*.md` para
o que existir na sua conta.

## Comandos

| Comando | O que faz |
|---|---|
| `/fluxo <objetivo>` | pipeline completo: explorar → implementar → testar → revisar |
| `/revisar <alvo>` | revisão de código com modelo pago |
| `/auditar <alvo>` | segunda opinião crítica |
| `/implementar <tarefa>` | implementação direta |
| `/pesquisar <pergunta>` | acervo + web + imagem/PDF |
| `/garantia <texto>` | auditoria de citação, página e selo de garantia |

Também é possível pedir um especialista pelo nome no prompt; o maestro lança o
subagente correspondente. Pergunta simples é respondida direto, sem subagente —
isso é proposital.

## Escada de modelos

| Nível | Uso | Exemplo de modelo |
|---|---|---|
| T0 | busca, leitura, formatação, documentação | `opencode/hy4-flash-free` |
| T1 | implementação e testes | `opencode/deepseek-v4.1-flash-free` |
| T2 | orquestração, arquitetura, pesquisa | `nvidia/nvidia/nemotron-3-ultra-550b-a55b` |
| T2-VL | imagem, PDF, diagrama | `nvidia/nvidia/nemotron-3.5-super-vl-120b-a12b` |
| T3 | revisão de código (pago) | `opencode/gpt-6-luna` |
| T4 | auditoria crítica (pago) | `opencode/claude-fable-5-2` |

Regras: tarefa mecânica começa em T0/T1; revisão é sempre T3/T4; subiu de nível,
não desce sozinho na mesma sessão.

## Escalada automática

`.opencode/plugins/escalada/index.ts` mantém um saldo de falhas de ferramenta por
sessão: erro soma 1, sucesso desconta 1. Ao chegar no limite, troca o modelo da
sessão e deixa um aviso sintético.

| Variável | Padrão | Efeito |
|---|---|---|
| `MULTIAGENTE_ESCALADA` | ligado | `0` desliga o plugin |
| `MULTIAGENTE_ESCALADA_FALHAS` | `3` | saldo de falhas para escalar |
| `MULTIAGENTE_ESCALADA_MODELO_1` | `opencode/gpt-6-luna` | primeiro nível |
| `MULTIAGENTE_ESCALADA_MODELO_2` | `opencode/claude-fable-5-2` | segundo nível |

Detalhes do desenho em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md#6-escalada).

## Fallback por cota

`.opencode/plugins/cota/index.ts` cobre o que a escalada não cobre: limite diário
do provedor (`429`, `402`, `usage limit`, `Insufficient balance`). Ele **veta o
retry** (para não formar storm), bloqueia o modelo por um cooldown persistido e
troca a sessão para um fallback configurado. Se não houver fallback configurado,
procura automaticamente outro modelo disponível (`ctx.model.list()`), preferindo
gratuito e outro provider. Sem alternativa, emite `COTA_ESGOTADA` e o maestro
registra `ESTADO: bloqueado`.

| Variável | Padrão | Efeito |
|---|---|---|
| `MULTIAGENTE_COTA` | ligado | `0` desliga o plugin |
| `MULTIAGENTE_COTA_FALLBACKS` | vazio | `de/para;de/para`, ex.: `opencode/gpt-6-luna>opencode/hy4-flash-free` |
| `MULTIAGENTE_COTA_RESERVA` | vazio | modelo usado quando não há fallback exato |
| `MULTIAGENTE_COTA_COOLDOWN_MS` | `86400000` | tempo de bloqueio do modelo (24h) |
| `MULTIAGENTE_COTA_AUTO` | ligado | `0` desliga a busca automática de alternativa |

A busca automática pode rebaixar T3/T4 para um modelo gratuito; se isso for
inaceitável, use `MULTIAGENTE_COTA_AUTO=0` e configure `FALLBACKS`/`RESERVA`
explicitamente. O bloqueio é gravado em `ctx.storage`, então sobrevive a restart.

Teste focado: `node --test .opencode/plugins/cota/logica.test.mjs`.

## Estrutura

```text
.
├── opencode.example.json
├── README.md
├── LICENSE
├── docs/
│   ├── ARQUITETURA.md
│   ├── COMO_USAR.md
│   └── PERSONALIZAR.md
└── .opencode
    ├── PROTOCOLO_AGENTES.md      # contrato comum (instructions)
    ├── OPENROUTER_MODELOS.md     # modelos gratuitos e especializados
    ├── README.md                 # referência rápida
    ├── agents/                   # 9 agentes
    ├── commands/                 # 6 comandos
    ├── plugins/escalada/         # escalada por falhas de ferramenta
    └── plugins/cota/             # fallback por cota/limite diário
```

## Segurança e privacidade

- Nenhuma credencial no repositório: use `opencode auth login` ou variáveis de
  ambiente no servidor do OpenCode.
- Caminhos absolutos da máquina de origem foram removidos; o exemplo usa
  `python servidor_mcp.py` como referência de MCP local.
- Modelos `:free` de gateways públicos podem ter limite de requisições e
  política de uso própria; não envie dado sensível para eles.
- Os plugins só trocam o modelo da sessão; não enviam conteúdo para lugar nenhum.

## Licença

MIT.
