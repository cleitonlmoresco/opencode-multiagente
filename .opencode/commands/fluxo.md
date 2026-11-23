---
description: Fluxo completo — explorar, implementar, testar e revisar
agent: maestro
---

Objetivo: $ARGUMENTS

Classifique a demanda e execute o fluxo do protocolo. Para mudança de código:

1. `explorador` mapeia o que existe (pode rodar em paralelo com `pesquisador`
   quando faltar fonte externa).
2. `implementador` faz o diff mínimo.
3. `testador` prova com comando + saída.
4. `revisor` (pago) revisa o diff.
5. `auditor` (pago) só entra em risco alto ou depois de 2 falhas.

Devolva o resumo final com arquivos tocados, provas, riscos e decisões
pendentes. Não pule a etapa de prova.
