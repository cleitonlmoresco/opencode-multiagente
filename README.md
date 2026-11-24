# opencode-multiagente

[![Licença GPL-3.0](https://img.shields.io/badge/license-GPL--3.0-blue.svg)](LICENSE)

Roster de agentes para o **OpenCode V2**: um maestro decompõe o pedido e delega
para especialistas, cada um com modelo e fronteira próprios. Inclui contrato de
handoff, escada de modelos por custo, comandos prontos, escalada por falha de
ferramenta, fallback automático por cota e uma **fonte única de regras** com
links entre projetos.

O maestro vem **desligado por padrão** no exemplo versionado: quem clona abre no
agente `build`. Ative somente no seu `opencode.json` local (ver Instalação).

Sem chave, token ou caminho pessoal versionado aqui. A autenticação fica no
OpenCode (`opencode auth login`) ou em variáveis de ambiente.

## Por que usar

- **Uma língua só**: todos os agentes seguem o mesmo contrato de prova e
  relatório.
- **Custo sob controle**: tarefa mecânica em modelo grátis; modelo pago só para
  revisão, auditoria e risco alto.
- **Fronteiras claras**: quem edita não revisa; quem revisa não edita; quem
  pesquisa não promove achado a verdade.
- **Escalada automática**: falha repetida de ferramenta sobe o modelo sozinha.
- **Anti-loop por cota**: `429`/`402`/`usage limit` não geram retry; após 2
  falhas o especialista é bloqueado e o plugin procura alternativa gratuita ou
  de outro provider.
- **Fonte única**: `.opencode/` é canônico; outros projetos usam junctions e o
  script `sincronizar-maestro.ps1` (com chave `autoAtualizacao`).
- **Maestro opt-in**: o example versionado não ativa `default_agent`.

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
3. Abra uma sessão nova (`/new`). Por padrão o maestro **não** é ativado: a
   sessão abre no agente `build`. O example.versionado não liga `default_agent`
   nem `instructions`.

Para ativar o maestro **somente na sua máquina**, acrescente ao `opencode.json`
local (que é ignorado pelo git):

```jsonc
{
  "default_agent": "maestro",
  "instructions": [".opencode/PROTOCOLO_AGENTES.md"]
}
```

```powershell
Copy-Item .opencode <destino> -Recurse
Copy-Item opencode.example.json <destino>\opencode.json
```

O `.opencode/` é **project-scoped**: só vale na pasta onde foi instalado. Para
usar em todos os projetos, copie os mesmos arquivos para `~/.config/opencode/` e
registre `instructions` e `default_agent` no `opencode.jsonc` global.


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

| Nível | Uso | Custo |
|---|---|---|
| T0 | busca, leitura, formatação, documentação | gratuito |
| T1 | implementação e testes | gratuito |
| T2 | orquestração, arquitetura, pesquisa | configurável |
| T2-VL | imagem, PDF, diagrama | configurável |
| T3 | revisão de código | pago |
| T4 | auditoria crítica | pago |

Regras: tarefa mecânica começa em T0/T1; revisão é sempre T3/T4; subiu de nível,
não desce sozinho na mesma sessão. Os IDs de modelo ficam em
`.opencode/agents/*.md` e não são publicados nesta página.

## Roteador automático

Nenhum ID de modelo é versionado. O plugin `.opencode/plugins/roteador/` atribui
um **papel** a cada agente (`barato`, `raciocinio`, `visao`, `pago`) e resolve o
modelo real no início da sessão:

1. `~/.config/opencode/multiagente-modelos.json` (opcional, por máquina), ex.:
   `{ "barato": "provider/modelo", "pago": "provider/modelo" }`.
2. Se ausente, `ctx.model.list()` escolhe automaticamente: gratuito para
   `barato`, não gratuito para `pago`, com visão para `visao`, com variantes de
   esforço para `raciocinio`.

`MULTIAGENTE_ROTEADOR=0` desliga e os agentes herdam o modelo da sessão. O
maestro nunca cita IDs — ele só escolhe o especialista.

## Escalada automática

`.opencode/plugins/escalada/index.ts` mantém um saldo de falhas de ferramenta por
sessão: erro soma 1, sucesso desconta 1. Ao chegar no limite, troca o modelo da
sessão e deixa um aviso sintético.

| Variável | Padrão | Efeito |
|---|---|---|
| `MULTIAGENTE_ESCALADA` | ligado | `0` desliga o plugin |
| `MULTIAGENTE_ESCALADA_FALHAS` | `3` | saldo de falhas para escalar |
| `MULTIAGENTE_ESCALADA_MODELO_1` | `<provider/modelo>` | primeiro nível |
| `MULTIAGENTE_ESCALADA_MODELO_2` | `<provider/modelo>` | segundo nível |

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
| `MULTIAGENTE_COTA_FALLBACKS` | vazio | `origem>destino;origem>destino` (definido localmente) |
| `MULTIAGENTE_COTA_RESERVA` | vazio | modelo usado quando não há fallback exato |
| `MULTIAGENTE_COTA_COOLDOWN_MS` | `86400000` | tempo de bloqueio do modelo (24h) |
| `MULTIAGENTE_COTA_AUTO` | ligado | `0` desliga a busca automática de alternativa |

A busca automática pode rebaixar T3/T4 para um modelo gratuito; se isso for
inaceitável, use `MULTIAGENTE_COTA_AUTO=0` e configure `FALLBACKS`/`RESERVA`
explicitamente. O bloqueio é gravado em `ctx.storage`, então sobrevive a restart.

Teste focado: `node --test .opencode/plugins/cota/logica.test.mjs`.

## Fonte única de regras (links)

O `.opencode/` deste repo é a **fonte canônica**. Outros projetos não copiam as
regras: eles as linkam por junction.

```powershell
# no repo (repara links e gera as instruções globais)
powershell -ExecutionPolicy Bypass -File .\scripts\sincronizar-maestro.ps1

# em qualquer projeto linkado (o link se autoatualiza)
powershell -ExecutionPolicy Bypass -File .\.opencode\atualizar-maestro.ps1
```

- `scripts/sincronizar-maestro.ps1` — reconstrói os junctions, regera
  `~/.config/opencode/INSTRUCOES_GLOBAIS.md` a partir de `INSTRUCOES_UNIVERSAIS.md`
  e instala o comando local em cada projeto.
- `scripts/projetos-linkados.txt` — um caminho de projeto por linha.
- `scripts/config.json` - `{ "autoAtualizacao": true }`. Mude para `false` (ou use
  `MAESTRO_AUTO_UPDATE=0`) para impedir a regeneração de links e instruções.
Edite `PROTOCOLO_AGENTES.md` (projeto) ou `INSTRUCOES_UNIVERSAIS.md` (globais), agentes, comandos ou plugins aqui e rode o script:
  a mudança chega a todos os projetos linkados. Se uma pasta estiver travada, o
  script sincroniza os arquivos por cópia e avisa.

## Estrutura

```text
.
├── scripts/
│   ├── sincronizar-maestro.ps1   # fonte unica / reparo de links
│   ├── atualizar-maestro-local.ps1
│   ├── projetos-linkados.txt
│   └── config.json               # autoAtualizacao true/false
├── opencode.example.json
├── README.md
├── LICENSE
├── docs/
│   ├── ARQUITETURA.md
│   ├── COMO_USAR.md
│   └── PERSONALIZAR.md
└── .opencode
    ├── PROTOCOLO_AGENTES.md      # contrato comum (instructions)
    ├── INSTRUCOES_UNIVERSAIS.md  # regras mínimas globais
    ├── atualizar-maestro.ps1     # gerado pelo script (opcional)
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

+

MIT.
