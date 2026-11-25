# Chat com Base Analítica Determinística Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Responder perguntas comerciais em português com cálculos reproduzíveis sobre uma base tratada e atualizada periodicamente a partir do Google Sheets.

**Architecture:** Compartilhar uma transformação de linhas entre servidor e painel, criar uma camada analítica em memória identificada pela versão do snapshot da planilha e consultar essa camada com interpretação determinística. O servidor formatará respostas sem LLM; o painel aberto consultará a versão a cada cinco minutos e atualizará os dados quando houver mudança.

**Tech Stack:** TypeScript, tRPC, React Query, Google Sheets API já existente, Vitest já instalado (sem acrescentar dependências).

**Spec:** `docs/superpowers/specs/2026-11-24-chat-base-analitica-deterministica-design.md`

## Global Constraints

- Não enviar perguntas, linhas da base ou resultados para Gemini, Groq, OpenAI ou qualquer serviço externo de IA.
- Atualização padrão em intervalos de cinco minutos; o cache da planilha é consultado sob demanda e pode ser local a cada instância do servidor.
- O chat e os gráficos devem aplicar as mesmas regras de preparação de dados e as correções de cliente já usadas pelo painel.
- Não tratar campos ausentes como zero, faturamento como lucro, quantidade faturada como produção, nem “implemento” como “carreta”.
- Rotular faturamento líquido como aproximado; não apresentar lucro ou margem sem definição aprovada.
- Manter leitura da planilha protegida por autenticação e não adicionar segredos ao repositório.
- Não introduzir dependências novas.

## Review Focus

- Datas e valores brasileiros inválidos ou vazios: preservar a distinção entre valor ausente, zero e linha inválida.
- Alteração de cabeçalhos: falhar claramente e preservar o último snapshot válido.
- Filtros compostos sem correspondência: retornar zero resultados sem remover silenciosamente filtros.
- Valores desconhecidos ou consulta ambígua: pedir esclarecimento ou explicar a limitação, sem ampliar a consulta.
- Planilha alterada entre consulta de versão e leitura paginada: rejeitar páginas de versões diferentes e refazer a carga.

---

### Task 1: Extrair e compartilhar a preparação da base

**Files:**
- Create: `shared/faturamentoData.ts` (ou módulo equivalente compatível com o `tsconfig` atual)
- Modify: `client/src/lib/faturamento.ts`
- Modify: `server/googleSheets.ts` somente se for necessário expor metadados tipados da versão/fonte

**Interfaces:**
- Produz uma função pura reutilizável que recebe linhas e correções de cliente e retorna registros normalizados, cobertura temporal e contagens de válidos/ignorados.
- Preserva a API `prepararDados` usada pelo painel como adaptador para evitar alterações funcionais não necessárias nos gráficos.

- [ ] Inspecionar os tipos existentes da linha da planilha, `CLIENTE_INFO_OVERRIDE` e as regras de `prepararDados`; manter tipos e aliases num único módulo compartilhado.
- [ ] Mover as regras de parsing de datas/valores, campos derivados e métricas existentes para a função pura compartilhada, preservando os mesmos resultados do painel.
- [ ] Atualizar `prepararDados` para delegar ao módulo compartilhado, sem duplicar lógica.
- [ ] Preparar uma checagem manual com linhas representativas da base: data brasileira, campo vazio, município/UF corrigidos, quantidade, faturamento e classificação do produto; comparar saída antes/depois no painel.

### Task 2: Construir camada analítica por versão da planilha

**Files:**
- Create: `server/faturamentoAnalytics.ts`
- Modify: `server/googleSheets.ts`
- Modify: `server/routers.ts`

**Interfaces:**
- `getFaturamentoAnalytics(): Promise<FaturamentoAnalytics>` obtém o snapshot atual e retorna a camada preparada vinculada a `sourceVersion`.
- A camada contém linhas normalizadas, dimensões/métricas realmente disponíveis, datas de cobertura, contagens de linhas e resumos reutilizáveis.

- [ ] Implementar cache em memória indexado por `sourceVersion`; reconstruir a camada somente quando o hash da fonte mudar.
- [ ] Não substituir um snapshot válido por vazio se a leitura falhar ou se o esquema mudar; propagar erro tipado para a rota.
- [ ] Produzir resumos comuns por período e dimensões frequentes, deixando filtros compostos adicionais para cálculo sob demanda.
- [ ] Expor ao chat metadados da camada: versão, horário da fonte, intervalo coberto, contagens válidas/ignoradas e dimensões ausentes.
- [ ] Conferir manualmente que duas consultas sobre a mesma versão reutilizam a camada e que uma nova versão provoca reconstrução.

### Task 3: Expandir parser e executor determinísticos

**Files:**
- Modify: `shared/chatDictionary.ts`
- Modify: `server/chatBaseQuery.ts`
- Modify: `server/chatSuggestions.ts`

**Interfaces:**
- Converter pergunta em consulta tipada com métrica, agrupamento, intervalo, filtros, ordenação e limite.
- Executar a consulta sobre `FaturamentoAnalytics`; o resultado identifica fonte, versão, filtros aplicados e cobertura.

- [ ] Adaptar o parser para resolver aliases contra dimensões e valores existentes na camada, incluindo períodos mensais/anuais, totais, médias suportadas, contagens distintas, rankings, comparações e detalhamentos descritos na especificação.
- [ ] Aplicar todos os filtros em conjunto; não remover filtro de representante, UF, produto ou período quando outro filtro também estiver presente.
- [ ] Restringir métricas a definições disponíveis; conservar faturamento bruto, quantidade faturada, custo, frete e tributos conforme existirem, e não criar lucro/margem.
- [ ] Retornar estado explícito para consulta respondida, ambígua, dimensão indisponível ou sem resultado; nenhuma condição deve virar uma consulta mais ampla implicitamente.
- [ ] Ajustar sugestões de continuação para consultar apenas métricas/dimensões válidas na mesma versão.
- [ ] Revisar estaticamente a compatibilidade com os casos já cobertos pelos testes existentes, sem alterar nem executar testes nesta etapa.

### Task 4: Remover LLM do fluxo do chat e formatar respostas com regras

**Files:**
- Modify: `server/routers.ts`
- Modify: `server/chatBaseQuery.ts` ou criar `server/chatResponse.ts` para apresentação determinística
- Modify: `server/chatSuggestions.ts`

**Interfaces:**
- A rota `ai.chat` mantém o contrato consumido pelo cliente, mas usa a camada analítica, o parser e o formatador determinísticos.
- `formatChatResponse(result): ChatResponse` gera texto/tabela com unidades e notas de cobertura sem chamada externa.

- [ ] Trocar a consulta à base bruta pela consulta tipada sobre a camada analítica.
- [ ] Remover `invokeLLM` e os dados enviados a ele deste fluxo; manter nomes públicos/contratos tRPC compatíveis com a interface existente.
- [ ] Formatar moeda, quantidades, períodos e rankings em português do Brasil; incluir fonte, intervalo e filtros relevantes.
- [ ] Mostrar claramente linha ignorada/cobertura parcial quando afetarem a resposta; explicar campos ausentes ou métricas indisponíveis.
- [ ] Rever estaticamente importações e fluxos da rota para confirmar que nenhuma resposta do chat depende de LLM.

### Task 5: Atualizar painel aberto quando a planilha mudar

**Files:**
- Modify: `server/routers.ts`
- Modify: `client/src/pages/Home.tsx`

**Interfaces:**
- Rota protegida de metadados retorna `sourceVersion` e `fetchedAt` sem retornar credenciais ou linhas da planilha.
- Cliente compara versão em intervalo de cinco minutos; ao mudar, invalida e recarrega snapshot e páginas usando uma única versão.

- [ ] Adicionar procedimento protegido de versão da base reaproveitando `getGoogleSheetBase` e o TTL de cinco minutos.
- [ ] Adicionar consulta periódica React Query no `Home.tsx` com intervalo de cinco minutos e pausa quando a aba estiver inativa.
- [ ] Ao detectar mudança de versão, cancelar carga paginada anterior, invalidar o cache da base e buscar todas as páginas para a nova versão.
- [ ] Atualizar os dados apresentados e indicar horário/estado de atualização; não misturar páginas de snapshots diferentes.
- [ ] Conferir manualmente a sequência inicial, versão sem alteração e versão alterada com dados paginados.

### Task 6: Revisar integração, segurança e entrega local

**Files:**
- Revisar os arquivos alterados nas tarefas anteriores
- Atualizar a especificação se alguma decisão técnica aprovada precisar de ajuste

- [ ] Conferir que rotas da base e da versão continuam autenticadas.
- [ ] Conferir que não houve dependências ou segredos novos e que nenhum dado comercial é enviado a serviços de IA.
- [ ] Revisar os cenários do Review Focus e os critérios de aceitação da especificação contra o código final.
- [ ] Fazer uma revisão visual/manual do chat e do painel atualizado em ambiente local, sem publicar ou fazer push sem pedido específico.

## Mapa de cobertura da especificação

- Preparação compartilhada e campos derivados: Task 1.
- Camada versionada, invalidação e cobertura: Task 2.
- Consultas, filtros, métricas e esclarecimentos: Task 3.
- Respostas determinísticas e ausência de LLM: Task 4.
- Atualização automática do painel e consistência de versão: Task 5.
- Autenticação, segurança, limites e critérios finais: Task 6.
