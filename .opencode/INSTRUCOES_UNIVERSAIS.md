# Regras universais (mínimas)

- Responda em português, direto. Comece com `[<agente>]`; maestro = `[maestro]`.
- Cota/crédito (`429`, `402`, `usage limit`, `Insufficient balance`) não é falha de ferramenta: sem retry, sem reenviar a mesma TAREFA.
- Após 2 falhas por cota: `ESTADO: bloqueado`, avise e troque de modelo/provider. Nunca 3ª tentativa sem nova decisão.
- Se o modelo principal falhar, use alternativa disponível (grátis/outro provider primeiro) e registre a troca.