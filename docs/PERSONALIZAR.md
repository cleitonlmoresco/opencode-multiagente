# Personalizar

## Trocar o modelo de um agente

Edite o `model` no frontmatter:

```yaml
---
description: ...
mode: subagent
model: opencode/deepseek-v4.1-flash-free
---
```

Depois confira:

```powershell
opencode debug agents
```

O agente deve aparecer com `model.providerID` e `model.id` novos.

## Adicionar um agente

1. Crie `.opencode/agents/<nome>.md`.
2. Preencha o frontmatter e o prompt.
3. Se for subagente do maestro, adicione o nome na allowlist dele.

```markdown
---
description: Responde dúvidas de SQL e revisa migrations.
mode: subagent
model: opencode/deepseek-v4.1-flash-free
steps: 20
permissions:
  - action: edit
    resource: "*"
    effect: deny
---

Você é o especialista em SQL. Leia o schema antes de responder.
Cite arquivo e linha. Não invente tabela ou coluna.
```

Para liberar um comando específico em vez de tudo:

```yaml
permissions:
  - action: bash
    resource: "pytest *"
    effect: allow
  - action: bash
    resource: "*"
    effect: deny
```

## Adicionar um comando

Crie `.opencode/commands/<nome>.md`:

```markdown
---
description: Explica um erro de teste e propõe a correção
---

Explique a causa do erro abaixo, cite arquivo e linha e proponha o diff mínimo.
Não edite nada antes de mostrar o diff.

$ARGUMENTS
```

O `$ARGUMENTS` recebe o texto digitado depois do comando.

## Escopo global

Para usar o roster em qualquer pasta:

```powershell
Copy-Item .opencode\agents "$env:USERPROFILE\.config\opencode\" -Recurse
Copy-Item .opencode\commands "$env:USERPROFILE\.config\opencode\" -Recurse
Copy-Item .opencode\PROTOCOLO_AGENTES.md "$env:USERPROFILE\.config\opencode\"
```

E no `opencode.jsonc` global:

```jsonc
{
  "default_agent": "maestro",
  "instructions": ["PROTOCOLO_AGENTES.md"]
}
```

Atenção: o protocolo tem regras de projeto (bancos, permissões). Se for usar
globalmente, revise o texto para não impor regra de um projeto a outro.

## Usar modelos gratuitos

O `opencode.example.json` já habilita o provider `openrouter`. Depois de

```powershell
opencode auth login openrouter
```

estes modelos entram no seletor:

```text
openrouter/liquid/lfm-3-1.7b:free
openrouter/openrouter/free
openrouter/google/gemma-4-31b-it:free
openrouter/google/gemma-4-26b-a4b-it:free
```

Os dois Gemma podem devolver `Provider returned error` por limite do endpoint
gratuito. O `openrouter/free` escolhe um modelo disponível automaticamente, mas
não serve para revisão de código: ele decide o modelo, não a qualidade.

Detalhes em [`.opencode/OPENROUTER_MODELOS.md`](../.opencode/OPENROUTER_MODELOS.md).

## Ajustar o teto de passos

`steps` limita quantas iterações o agente faz. Valor baixo corta tarefa longa;
valor alto aumenta o custo. O default do roster:

| Agente | steps |
|---|---:|
| `maestro` | 40 |
| `explorador` | 25 |
| `implementador` | 30 |
| `testador` | 30 |
| `revisor` | 30 |
| `auditor` | 40 |
| `pesquisador` | 40 |

## Testar a instalação

```powershell
opencode debug agents          # todos os agentes e modelos
opencode debug config          # configuração efetiva
opencode plugin list           # plugin escalada
opencode models | Select-String openrouter
```

Teste de fumaça em sessão descartável:

```powershell
opencode run --agent maestro "Use o explorador para localizar a função main e responda com caminho:linha."
```

O esperado é um card do `explorador` com `RELATÓRIO` contendo a prova.
