# Arquitetura

O ambiente tem cinco peças. Nenhuma delas é um serviço separado: tudo roda
dentro do processo do OpenCode.

```text
opencode.json
   │  default_agent, instructions, model, providers
   ▼
.opencode/PROTOCOLO_AGENTES.md        (injetado em toda sessão)
   │  língua comum, handoff, escada, fronteiras
   ▼
.opencode/agents/*.md                 (quem existe e o que pode)
   │  modelo, permissões, prompt
   ▼
.opencode/commands/*.md               (atalhos de fluxo)
   │
   ▼
.opencode/plugins/escalada/index.ts   (falha de ferramenta → sobe)
    │
    ▼
.opencode/plugins/cota/index.ts       (cota esgotada → fallback ou bloqueio)
```

## 1. Configuração

`opencode.json` faz quatro coisas:

| Campo | Efeito |
|---|---|
| `default_agent` | define quem abre a sessão nova |
| `instructions` | injeta o protocolo em toda sessão |
| `agents.<id>.model` | sobrescreve o modelo de agentes embutidos (`title`, `explore`, `general`, `plan`) |
| `providers` | habilita provider adicional, como `openrouter` |

O arquivo é **project-scoped**. Fora da pasta, nada disso existe — foi uma
escolha de desenho para não impor o roster a outros repositórios.

## 2. Protocolo

`PROTOCOLO_AGENTES.md` é o contrato que todos leem. Ele não executa nada; ele
muda o comportamento porque entra no contexto de cada agente.

O que ele fixa:

- **prova ao lado da afirmação** — `caminho:linha`, `documento p.página`,
  comando + saída;
- **sem prova = sem garantia** — lacuna não é preenchida com conhecimento geral;
- **handoff** — quem delega manda `TAREFA`, quem executa devolve `RELATÓRIO`;
- **fronteiras** — quem edita não revisa, quem revisa não edita;
- **escada** — quando subir de modelo e quando não subir.

## 3. Agentes

Cada arquivo em `.opencode/agents/` é um agente. O frontmatter YAML define o
comportamento; o corpo é o prompt de sistema.

```yaml
---
description: Revisão de código somente leitura (modelo pago).
mode: all          # primary | subagent | all
model: opencode/gpt-6-luna
steps: 30          # teto de passos
permissions:
  - action: edit
    resource: "*"
    effect: deny
---
```

`mode: primary` aparece no seletor de agente. `subagent` só é chamado por outro
agente. `all` serve para os dois casos.

Permissões são allowlist/denylist por ação e recurso. O `maestro`, por exemplo,
nega `edit` e libera `subagent` só para os nomes da lista.

## 4. Comandos

Um comando é um Markdown com `description` no frontmatter. O corpo vira o prompt
enviado ao agente ativo. É o jeito de forçar um caminho sem depender da
classificação do maestro.

## 5. Ciclo de uma requisição

1. Você envia o pedido na sessão do `maestro`.
2. O maestro classifica: pergunta simples, código, pesquisa, revisão ou risco.
3. Se for simples, responde direto.
4. Se precisar de especialista, envia `TAREFA` ao subagente.
5. O subagente executa com o próprio modelo e as próprias permissões.
6. O subagente devolve `RELATÓRIO` com provas.
7. O maestro confere as provas, cobra o que faltou e consolida a resposta.

O maestro **não** edita arquivos. Isso evita que o orquestrador "conserte" por
conta própria o que o especialista entregou.

## 6. Escalada

O plugin mantém, em memória, dois mapas por sessão: saldo de falhas e nível
atual.

```text
erro de ferramenta   → saldo + 1
sucesso de ferramenta → saldo - 1 (mínimo 0)
novo prompt           → saldo = 0
saldo >= limite       → troca o modelo, zera o saldo, nível + 1
```

A troca usa `session.switchModel` e deixa uma mensagem sintética na sessão,
para o usuário saber que o modelo mudou e por quê.

Propriedades do desenho:

- **não faz downgrade**: subiu, fica;
- **não persiste**: reiniciar o servidor zera os contadores;
- **não mexe nos subagentes**: cada um mantém o modelo do seu arquivo;
- **desligável**: `MULTIAGENTE_ESCALADA=0`;
- **ignora `question`**: pedir esclarecimento ao usuário não conta como falha.

Configuração:

| Variável | Padrão |
|---|---|
| `MULTIAGENTE_ESCALADA` | ligado |
| `MULTIAGENTE_ESCALADA_FALHAS` | `3` |
| `MULTIAGENTE_ESCALADA_MODELO_1` | `opencode/gpt-6-luna` |
| `MULTIAGENTE_ESCALADA_MODELO_2` | `opencode/claude-fable-5-2` |

## 7. Fallback por cota

`escalada` trata falha de ferramenta. `cota` trata falha de **modelo/provedor**
por limite diário: status `429`/`402` ou mensagem de rate limit, quota, usage
limit, budget excedido etc.

```text
erro de cota → ctx.session.hook("retry")
             → decision = { retry: false }   (sem storm)
             → bloqueia provider/modelo por MULTIAGENTE_COTA_COOLDOWN_MS
             → switchModel para fallback (ou reserva)
             → mensagem sintética COTA_ESGOTADA na sessão
```

O bloqueio fica em `ctx.storage` (`cota:bloqueios`), então sobrevive a restart.
`experimental.model.resolve` desvia um modelo bloqueado dentro do mesmo provider.
Não há fallback padrão: T3/T4 sem configuração explícita viram
`ESTADO: bloqueado`, nunca uma revisão rebaixada em silêncio.

| Variável | Padrão |
|---|---|
| `MULTIAGENTE_COTA` | ligado (`0` desliga) |
| `MULTIAGENTE_COTA_FALLBACKS` | vazio (`de/para;de/para`) |
| `MULTIAGENTE_COTA_RESERVA` | vazio |
| `MULTIAGENTE_COTA_COOLDOWN_MS` | `86400000` |

Teste focado: `node --test .opencode/plugins/cota/logica.test.mjs`.

## 8. O que este desenho não faz

- Não roteia por intenção automaticamente: quem decide é o maestro, lendo o
  protocolo. Não há classificador determinístico.
- Não impede o modelo de errar: o protocolo reduz o risco, não elimina.
- Não compartilha memória entre sessões. Cada sessão tem o próprio contexto.
- Não controla custo por orçamento: a escada é qualitativa, não um medidor de
  gasto.
- Não substitui revisão humana em mudança crítica.
