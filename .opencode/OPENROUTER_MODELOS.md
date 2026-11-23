# Modelos OpenRouter no ambiente

Provider nativo: `openrouter`. O ID completo do OpenRouter vai depois do
prefixo: `openrouter/google/gemma-4-31b-it:free`.

## Como habilitar

1. Gere uma chave em <https://openrouter.ai/keys>.
2. Dê a chave ao servidor OpenCode de uma destas formas:
   - defina `OPENROUTER_API_KEY` no ambiente do usuário e reinicie o serviço;
   - rode `opencode auth login openrouter` e cole a chave.
3. Recarregue com `/reload` e confira:

```powershell
opencode models | Select-String openrouter
```

Sem chave, os IDs aparecem na configuração mas a requisição falha com 401.
Modelos `:free` têm limite de requisições do OpenRouter; para uso pesado,
confira o limite da conta.

## Chat / agentes (tool calling)

| ID OpenRouter | Contexto | Destaques | Uso sugerido |
|---|---:|---|---|
| `google/gemma-4-31b-it:free` | 262K | Denso 30,7B; texto, imagem e vídeo; raciocínio configurável; tool calling nativo | T1 alternativo para código e revisão leve |
| `google/gemma-4-26b-a4b-it:free` | 262K | MoE 25,2B totais / 3,8B ativos; texto, imagem e vídeo (até 60s a 1 fps) | T2-VL alternativo para imagem/PDF/vídeo |
| `liquid/lfm-3-1.7b:free` | 262K | Compacto 1,7B; raciocina antes de responder; foco em tool calling e JSON estruturado | T0 mecânico, extração de JSON, roteamento |
| `openrouter/free` | 200K | Roteador automático: escolhe um modelo gratuito compatível com a requisição | Fallback quando o modelo fixo falhar |

Confirmado na API do OpenRouter em 2026-11-23: os quatro aceitam `tools`;
entrada de imagem/vídeo nos dois Gemma e no roteador (texto/imagem).

**Status dos testes com a chave instalada:**

- `liquid/lfm-3-1.7b:free` — respondeu.
- `openrouter/openrouter/free` — respondeu.
- `google/gemma-4-31b-it:free` e `google/gemma-4-26b-a4b-it:free` —
  `AI.Error.RateLimit: Provider returned error`. A credencial está ok; o limite
  é do endpoint gratuito do provedor upstream. Tente mais tarde ou use o
  `openrouter/free`.

Seleção no OpenCode:

```text
/model openrouter/google/gemma-4-31b-it:free
/model openrouter/liquid/lfm-3-1.7b:free
/model openrouter/openrouter/free
```

## Especializados (fora do chat)

Estes endpoints não são modelos de conversa com tool calling; o seletor de
chat do OpenCode não os opera. Ficam registrados para os pipelines do
Pepertilo.

| ID OpenRouter | Categoria | Destaques | Onde usaria |
|---|---|---|---|
| `recraft/recraft-v4.1-flash-v2:free` | Geração de imagem | Texto-para-imagem rápido; aceita paleta (`rgb_colors`) e cor de fundo | Diagramas, capas, material visual |
| `heygen/heygen-voice-turbo:free` | TTS | PCM mono 44,1 kHz; 39 idiomas; até 5.000 caracteres/requisição | Voz do chat / leitura de laudos |
| `fish-audio/s2.1-pro:free` | TTS | Síntese para testes e prototipagem de baixo volume | Testes de voz |
| `respan/span-01-lite:free` | Decisão / avaliação | Pontuação comportamental: probabilidade de um comportamento em trechos de conversa | Avaliar respostas do chatbot |
| `nvidia/nemotron-3.5-rerank-8b:free` | Reranking (RAG) | Reranker 8B para ordenar relevância | Reordenar páginas do `indice.db` |
| `nvidia/nemotron-3.5-embed-8b:free` | Embeddings multimodal | Vetores 4096; indexa texto e imagens de documentos | Indexação do acervo (tabelas/gráficos) |
| `nvidia/nemotron-3.5-embed-1b:free` | Embeddings multimodal | Vetores 2048; versão leve para texto e imagens | Indexação incremental |
| `nvidia/nemotron-3-embed-1b:free` | Embeddings de texto | Busca corporativa, RAG e código com baixa latência | Busca textual rápida |

## Regras

- Modelo `:free` não muda o selo de garantia do Pepertilo: resposta de LLM
  continua `REVISAR`/`SEM_GARANTIA`.
- Não use o roteador `openrouter/free` para revisão de código: ele escolhe o
  modelo, não garante qualidade. Revisão continua em T3/T4.
- Se o OpenRouter estiver fora ou sem chave, o ambiente cai para os modelos
  locais já configurados; nenhum agente depende dele.
