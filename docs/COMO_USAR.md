# Como usar

Guia prático do dia a dia. Para entender o desenho por dentro, veja
[`ARQUITETURA.md`](ARQUITETURA.md). Para trocar modelos e criar agentes, veja
[`PERSONALIZAR.md`](PERSONALIZAR.md).

## 1. Abrir a sessão

```powershell
cd <pasta-do-projeto>
opencode
```

Abra uma sessão nova com `/new`. O rodapé deve mostrar o agente e o modelo:

```text
maestro · <modelo-raciocinio>
```

O `maestro` só é o padrão se `default_agent` estiver no `opencode.json` **daquele
projeto**. Sessão antiga não troca de agente sozinha.

## 2. Fazer um pedido

Escreva o objetivo como falaria com uma pessoa. Não precisa escolher agente.

```text
corrija o bug do parser de configuração e rode o teste focado
```

O maestro decide:

- pergunta factual simples → responde direto, sem subagente;
- código → `explorador` → `implementador` → `testador` → `revisor`;
- pesquisa → `pesquisador`;
- auditoria → `auditor` ou `guardiao`.

## 3. Usar um comando

Os comandos forçam um caminho, sem depender da classificação do maestro.

| Comando | Quando usar |
|---|---|
| `/fluxo <objetivo>` | quer o pipeline completo com revisão no fim |
| `/revisar <alvo>` | só a revisão, sem implementar nada |
| `/auditar <alvo>` | risco alto ou segunda opinião sobre um parecer |
| `/implementar <tarefa>` | já sabe o que fazer e quer só a edição + teste |
| `/pesquisar <pergunta>` | precisa de fonte externa (web, PDF, imagem) |
| `/garantia <texto>` | quer conferir se cada afirmação tem fonte |

Exemplos:

```text
/fluxo adicionar validação de e-mail no cadastro e cobrir com teste
/revisar o diff atual
/auditar a mudança em src/parser.py e o relatório do implementador
/implementar renomear a função carregar para carregar_config
/pesquisar qual o torque do parafuso da tampa do motor
/garantia "A tensão no pino 3 é 5 V (manual p.42)."
```

## 4. Chamar um especialista pelo nome

O maestro respeita o pedido explícito:

```text
use o explorador para localizar onde está a função responder
peça ao revisor para revisar o diff atual
chame o auditor: o revisor aprovou, mas quero segunda opinião
```

## 5. Saber que a delegação aconteceu

- O rodapé continua no `maestro`.
- Cada subagente aparece como um card separado, com o `RELATÓRIO`.
- O relatório traz `ESTADO`, `FIZ`, `PROVAS`, `RISCOS` e `PRÓXIMO`.
- A resposta final do maestro consolida arquivos tocados, comandos e riscos.

Se nada disso aparecer, consulte a seção de problemas abaixo.

## 6. Trocar o modelo da sessão

```text
/model
```

Escolha na lista. Modelos gratuitos conhecidos:

```text
<modelo-barato>
<modelo-barato>
<modelo-alternativo>
<modelo-alternativo>
```

Trocar o modelo da sessão **não** troca o modelo dos subagentes: cada agente tem
o seu em `.opencode/agents/*.md`.

## Problemas comuns

### O maestro não aparece

- Confirme que abriu o OpenCode **na pasta do projeto**.
- Rode `opencode debug agents` e procure `maestro`.
- Sessão antiga: `/new`.

### `opencode plugin list` diz "No plugins found"

Você está fora da pasta do projeto. O `.opencode/` é project-scoped.

### Erro 401/403 em modelo OpenRouter

```powershell
opencode auth login openrouter
```

Ou defina `OPENROUTER_API_KEY` no ambiente do servidor e reinicie.

### `Provider returned error` em modelo `:free`

Limite do endpoint gratuito do provedor upstream, não da sua chave. Tente mais
tarde ou use outro modelo/roteador.

### O agente editou o que não devia

O `maestro` tem `edit: deny`. Se o seu agente customizado não tiver, ele pode
editar. As permissões ficam no YAML de cada `.opencode/agents/*.md`.

### Subagente não é chamado

- Confira se o subagente está na allowlist do maestro.
- Peça explicitamente: "use o explorador para...".
- Verifique `opencode debug agents` — agente com erro de YAML não carrega.
