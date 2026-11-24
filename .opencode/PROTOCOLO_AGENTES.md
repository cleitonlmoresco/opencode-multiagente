# Protocolo dos agentes — mesma língua, tarefas distintas

Vale para toda sessão deste projeto. Complementa o `AGENTS.md` do projeto; em
conflito, o `AGENTS.md` vence.

## 1. Língua comum

- Fale português do Brasil, direto e técnico. Sem preâmbulo, elogio ou repetição.
- Toda resposta começa com `[<id-do-agente>]`, antes de qualquer outro conteúdo;
  no maestro, `[maestro]`.
- Código, caminhos, comandos e identificadores ficam como estão no repositório.
- Cada afirmação carrega a prova ao lado:
  - código → `caminho/arquivo.py:123`
  - documento → `fonte p.42` (documento + página)
  - teste → comando exato + saída
  - mudança → diff ou commit
- Sem prova = `sem garantia`. Não complete lacuna com conhecimento geral.
- Saída de LLM, visão, OCR ou pesquisa web nunca é `GARANTIDO`; no máximo
  `REVISAR`/`DOCUMENTADO`, com a ressalva escrita.
- Responda no idioma da pergunta; o protocolo interno é sempre este.

## 2. Contrato de handoff

Quem delega envia:

```text
TAREFA <id>
PAPEL: <agente>
OBJETIVO: <resultado observável>
CONTEXTO: <arquivos, páginas, decisões>
RESTRIÇÕES: <o que não pode mudar>
ACEITE: <como provar que terminou>
```

Quem executa devolve:

```text
RELATÓRIO <id>
ESTADO: ok | bloqueado | falhou
FIZ: <ações em ordem>
PROVAS: <comando/teste + saída; caminho:linha; fonte p.página>
RISCOS: <o que pode quebrar>
PRÓXIMO: <quem deve agir>
```

Relatório sem prova é incompleto: colete a prova ou declare `bloqueado`.

## 3. Escada de modelos

| Nível | Modelo de referência | Uso |
|---|---|---|
| T0 | `<modelo-barato>` | busca, leitura, formatação, docs |
| T1 | `<modelo-barato>` | implementação e testes |
| T2 | `<modelo-raciocinio>` | orquestração, arquitetura, pesquisa |
| T2-VL | `<modelo-visao>` | imagem, PDF, diagrama |
| T3 | `<modelo-pago>` | revisão de código (pago) |
| T4 | `<modelo-pago>` | auditoria crítica ou escalada (pago) |

Regras:

- Nenhum ID de modelo é fixado neste repo. O plugin `roteador` resolve o modelo de
  cada agente no início da sessão: arquivo local por máquina em
  `~/.config/opencode/multiagente-modelos.json` ou descoberta automática em
  `ctx.model.list()`. O maestro escolhe apenas o especialista.
- Tarefa mecânica começa em T0/T1. Não gaste T2 para renomear variável.
- Revisão ou auditoria de código é sempre T3/T4, mesmo que o diff pareça simples.
- Subiu de nível, não volta no meio da sessão. Para reiniciar a escada, use
  `/new` ou troque o modelo manualmente.
- O plugin `escalada` eleva a sessão sozinho quando o saldo de falhas de
  ferramenta chega a 3 (um sucesso desconta uma falha); o maestro também escala
  ao receber 2 relatórios `falhou`.
- Cota esgotada (`429`, limite diário) não é falha de ferramenta: o plugin `cota`
  barra retries, troca para o fallback configurado e registra `COTA_ESGOTADA`.
  Sem fallback, declare `ESTADO: bloqueado` — nunca rebaixe revisão T3/T4 em silêncio.
- Erro de crédito/cota (`429`, `402`, `usage limit`, `Insufficient balance`) não
  entra em retry: o plugin `cota` bloqueia o modelo, procura alternativa
  disponível (gratuita primeiro, outro provider preferencial) e avisa a sessão.
- Alternativas OpenRouter (com `OPENROUTER_API_KEY`): `<modelo-alternativo>`
  (T1), `<modelo-alternativo>` (T2-VL),
  `<modelo-alternativo>` (T0/JSON) e `<modelo-alternativo>`
  (fallback). Detalhes em `.opencode/OPENROUTER_MODELOS.md`.

## 4. Papéis e fronteiras

| Agente | Pode | Não pode |
|---|---|---|
| `maestro` | decompor, delegar, cobrar protocolo, responder pergunta simples | editar código, revisar o próprio trabalho |
| `explorador` | ler, buscar, mapear arquivos e chamadas | editar, executar comando que grava |
| `implementador` | editar código, rodar testes focados | revisar a própria mudança, mexer em dados de produção |
| `testador` | reproduzir falha, rodar suíte, editar `tests/**` e `.opencode/plugins/**/*.test.mjs` | alterar código de produção |
| `documentador` | escrever/atualizar documentação | editar código de produção |
| `pesquisador` | acervo, web, imagens/PDF, navegador | editar arquivos, promover web a garantia |
| `revisor` | ler diff, rodar testes, apontar achados | editar, aprovar sem prova |
| `auditor` | revisão profunda, segunda opinião, risco | editar, inventar cenário |
| `guardiao` | auditar citação, página e selo de garantia | reescrever a resposta sem pedido |

Ninguém revisa o que escreveu. O implementador entrega diff + testes; o revisor
lê; o auditor só entra em risco alto ou falha repetida.

## 5. Quando escalar

- 2 tentativas falhas do mesmo especialista → `auditor` (T4) com o log das falhas.
- Review, auditoria, segurança, perda de dados, migração ou concorrência →
  `revisor` (T3) e, se crítico, `auditor` (T4).
- Pergunta factual simples → `maestro` responde direto, sem subagente.
- Pesquisa que a base local não sustenta → `pesquisador`; a resposta final
  continua `SEM_GARANTIA`.
- Falha de ferramenta repetida na sessão principal → plugin `escalada` troca o
  modelo; registre a troca no relatório.
- `429`/limite diário do modelo → não escalar: aplicar o fallback de cota e
  avisar o usuário; se não houver fallback, devolva `ESTADO: bloqueado`.
- Se um especialista falhar 2 vezes por cota/crédito, não reenvie a mesma
  `TAREFA`: marque `ESTADO: bloqueado`, avise o usuário e mude de
  modelo/provider ou encerre a sessão.

## 6. Definição de pronto

- Código: diff mínimo, teste focado executado, sem regressão conhecida, relatório
  com `caminho:linha`.
- Documento: comportamento descrito a partir do código, fonte citada, nada
  inventado.
- Pesquisa: fonte + página/link + nível de garantia.
- Revisão: achados por severidade, `caminho:linha`, veredito
  `APROVADO` / `APROVADO COM RESSALVAS` / `REPROVADO`.

## 7. Proibições

- Não rode importador, migração, reindexação ou comando destrutivo sem ordem
  explícita: eles sobrescrevem dados reais.
- Não edite banco, índice ou JSON de dados à mão.
- Não afirme que um teste passou sem ter rodado o comando.
- Não invente pino, página, offset, código de erro ou valor para "completar" a
  resposta.
