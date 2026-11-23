# opencode-multiagente

Roster de agentes para o **OpenCode V2**: um maestro que decompõe o pedido e
delega para especialistas, cada um com modelo e fronteira próprios. O pacote
inclui o contrato de handoff, a escada de modelos por custo, comandos prontos e
um plugin de escalada automática por falhas de ferramenta.

Nenhuma chave, token ou caminho pessoal está versionado aqui. A autenticação
fica no OpenCode (`opencode auth login`) ou em variáveis de ambiente.

## Requisitos

- OpenCode **v2.2.5** ou superior
- Pelo menos um provider autenticado (`opencode auth list`)
- Modelos citados abaixo disponíveis na sua conta; ajuste os IDs se necessário

## Instalação em um projeto

1. Copie a pasta `.opencode/` para a raiz do projeto.
2. Copie `opencode.example.json` para `opencode.json` na raiz e mescle com a
   configuração que já existir.
3. Abra uma sessão nova (`/new`). O rodapé deve mostrar `maestro · <modelo>`.

```powershell
Copy-Item .opencode <destino> -Recurse
Copy-Item opencode.example.json <destino>\opencode.json
```

O `.opencode/` é **project-scoped**: só vale na pasta onde foi instalado. Para
usar em todos os projetos, copie os arquivos para `~/.config/opencode/`.

## Elenco

| Agente | Modelo | Papel |
|---|---|---|
| `maestro` | Nemotron 3 Ultra 550B | orquestra, delega, cobra o protocolo; não edita |
| `explorador` | HY4 Flash | busca e leitura somente leitura |
| `implementador` | DeepSeek V4.1 Flash | edita código com diff mínimo |
| `testador` | DeepSeek V4.1 Flash | reproduz falha, roda suíte, edita `tests/**` |
| `documentador` | HY4 Flash | escreve documentação; não edita `.py` |
| `pesquisador` | Nemotron 3.5 Super VL 120B | acervo, web, imagem/PDF |
| `revisor` | GPT-6 Luna (pago) | revisão de diff, somente leitura |
| `auditor` | Claude Fable 5.2 (pago) | segunda opinião e risco alto |
| `guardiao` | Nemotron 3 Ultra 550B | confere citação, página e garantia |

Os modelos são apenas o ponto de partida. Troque os IDs em
`.opencode/agents/*.md` para o que existir na sua conta.

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
subagente correspondente.

## Contrato de handoff

O `PROTOCOLO_AGENTES.md` é injetado em toda sessão via `instructions`. Ele fixa:

- língua comum e formato de prova (`caminho:linha`, `livro p.página`, comando + saída);
- contrato `TAREFA` (quem delega) e `RELATÓRIO` (quem executa);
- escada de modelos T0–T4 e quando subir;
- fronteiras de cada papel (quem edita, quem revisa, quem só lê);
- regras de garantia: saída de LLM/OCR/pesquisa nunca vira `GARANTIDO`.

## Escalada automática

`.opencode/plugins/escalada/index.ts` mantém um saldo de falhas de ferramenta
por sessão: erro soma 1, sucesso desconta 1. Ao chegar no limite, troca o modelo
da sessão e deixa um aviso sintético.

| Variável | Padrão | Efeito |
|---|---|---|
| `PEPERTILO_ESCALADA` | ligado | `0` desliga o plugin |
| `PEPERTILO_ESCALADA_FALHAS` | `3` | saldo de falhas para escalar |
| `PEPERTILO_ESCALADA_MODELO_1` | `opencode/gpt-6-luna` | primeiro nível |
| `PEPERTILO_ESCALADA_MODELO_2` | `opencode/claude-fable-5-2` | segundo nível |

A sessão não volta de nível sozinha: use `/new` ou troque o modelo na mão.

## Custo

A escada existe para gastar pouco:

- T0/T1: modelos gratuitos para busca, leitura e implementação;
- T2: orquestração e pesquisa;
- T3/T4: só revisão, auditoria, risco alto ou falha repetida.

## Estrutura

```text
.
├── opencode.example.json
└── .opencode
    ├── PROTOCOLO_AGENTES.md
    ├── OPENROUTER_MODELOS.md
    ├── README.md
    ├── agents/       (9 agentes)
    ├── commands/     (6 comandos)
    └── plugins/escalada/index.ts
```

## Segurança

- Sem credenciais no repositório: use `opencode auth login` ou variáveis de
  ambiente no servidor do OpenCode.
- Caminhos absolutos da máquina de origem foram removidos; o exemplo usa
  `python servidor_mcp.py` como referência de MCP local.
- Modelos `:free` de gateways públicos podem ter limite de requisições e
  política de uso própria; não envie dado sensível para eles.

## Licença

MIT.
