# Chat com base analítica determinística — Design

## Objetivo

Permitir que usuários autenticados façam perguntas em linguagem natural sobre a base comercial publicada no Google Sheets. O sistema deve interpretar a intenção, calcular respostas a partir dos registros tratados e atualizar suas análises quando a planilha mudar. Nenhum modelo de IA externo participa da interpretação ou da redação.

## Situação atual

- `server/googleSheets.ts` lê a aba configurada, valida os cabeçalhos, calcula uma versão por hash e mantém snapshot em memória por cinco minutos.
- O painel carrega a base e executa `prepararDados` em `client/src/lib/faturamento.ts`, incluindo normalização de datas e valores, derivação de região, família, grupo de modelo, categoria e métricas financeiras.
- A consulta do chat (`server/chatBaseQuery.ts`) já interpreta alguns termos e calcula totais/rankings na base bruta. `shared/chatDictionary.ts` contém aliases e definições de negócios.
- Depois do cálculo, `server/routers.ts` chama `invokeLLM` para escrever a resposta. O chat não usa o tratamento completo feito pelo painel e a tela aberta não recarrega automaticamente quando a planilha muda.

## Abordagens consideradas

1. **Pré-calcular cada combinação de pergunta e filtro.** Rejeitada: combinações de tempo, produto, cliente, equipe e geografia crescem rapidamente; ainda seria impossível enumerar todas as perguntas.
2. **Reprocessar todas as linhas a cada pergunta.** Funciona inicialmente e é simples, mas repete a limpeza e agregações mesmo quando a base não mudou.
3. **Criar uma camada analítica por versão da planilha e calcular consultas sobre ela.** Escolhida: normaliza os registros uma vez por versão, prepara índices/resumos comuns e calcula dinamicamente combinações válidas. Não depende de serviço de IA, suporta filtros compostos e mantém números reproduzíveis.

## Desenho escolhido

### Preparação da base

- Unificar as regras de `prepararDados` em módulo reutilizável no servidor e no painel para que o chat e os gráficos usem os mesmos campos derivados e definições.
- Preservar as correções manuais de clientes existentes e documentar quais campos são fonte da planilha e quais são derivados.
- Tratar datas brasileiras, valores monetários e quantidades, nomes de colunas/aliases, valores ausentes e classificação de produto.
- Validar linhas e esquema. Linhas sem data ou inválidas não entram nas métricas temporais; a resposta deve expor contagens de linhas válidas/ignoradas e a razão quando relevante. Campo ausente não deve virar zero silenciosamente.
- Gerar uma camada analítica identificada por `sourceVersion`: registros normalizados, intervalo coberto, dimensões e métricas disponíveis, além de agregações reutilizáveis por período e dimensões frequentes. Combinações adicionais são calculadas sob demanda e podem ser memorizadas apenas para aquela versão.

### Interpretação e resposta

- Converter cada pergunta em uma consulta tipada: métrica, agrupamento, período, filtros, ordenação e limite.
- Usar regras determinísticas, dicionário de negócios e valores realmente presentes na base. Expandir o suporte com famílias de pergunta: totais, médias, contagens distintas, rankings, séries mensal/anual, comparações entre períodos e detalhamento por produto, cliente, representante, cidade, UF, região, tipo de venda, família, grupo, cor e demais dimensões confirmadas no esquema.
- Executar todos os cálculos no servidor sobre a camada analítica; filtros visuais do navegador não alteram a pergunta, a menos que o usuário os informe explicitamente.
- Montar texto e tabelas a partir dos resultados calculados. Se a intenção for ambígua, perguntar o que falta; se métrica ou coluna não existir, explicar a limitação. Nunca inferir lucro como faturamento, produção como quantidade faturada ou associação de categoria sem regra confirmada.
- Sugestões de continuação devem ser produzidas por regras e só aparecer quando a consulta correspondente for válida para a mesma versão da base.
- Nenhuma linha comercial, pergunta ou resultado será enviado a Gemini, Groq, OpenAI ou outro serviço de IA externo.

### Atualização automática

- Manter a verificação da planilha em intervalo padrão de cinco minutos, alinhada ao TTL atual, e expor versão e horário da fonte.
- Quando o hash da planilha mudar, invalidar camada tratada e agregações anteriores e reconstruí-las antes de responder com a nova versão.
- O painel aberto verifica a versão periodicamente; ao detectar mudança, recarrega os lotes e reconstrói os dados exibidos, mostrando que a atualização ocorreu.
- A atualização é eventual, não instantânea: a planilha é consultada quando houver chamadas ao serviço, e o cache atual é local ao processo do servidor. Se a consistência imediata ou entre instâncias se tornar necessária, será preciso adicionar armazenamento compartilhado ou gatilho confiável da planilha.

## Escopo

**Inclui:** tratamento unificado, camada analítica versionada, interpretação determinística do chat, respostas calculadas, perguntas de esclarecimento, indicação de fonte/período/cobertura e atualização automática até aproximadamente cinco minutos.

**Não inclui:** integração com Gemini ou outro LLM, consultas a fontes externas, gravação na planilha, previsões futuras nem respostas consultivas sem suporte nos dados.

## Restrições e cuidados

- A camada de dados continua protegida por autenticação e só pode ler a planilha.
- Só métricas com definição comercial clara podem ser expostas. “Faturamento líquido aproximado” deve manter esse rótulo; lucro/margem requer definição e dados de custo aprovados.
- Ordenação, períodos, comparações e agrupamentos precisam ser validados contra os campos disponíveis; respostas devem citar fonte, período e filtros aplicados.
- Mudanças de cabeçalho na planilha devem falhar com mensagem clara e não substituir dados válidos por snapshot vazio.
- A implementação deve aproveitar dependências atuais e não inserir segredos no repositório.

## Critérios de aceitação

1. Painel e chat usam a mesma transformação de linha e os mesmos valores derivados.
2. Uma pergunta estruturada é resolvida sem chamada externa de IA e seus números vêm de cálculo reproduzível.
3. Filtros compostos por período e dimensões reais funcionam em totais e rankings.
4. Perguntas ambíguas, dimensões ausentes e métricas sem definição geram esclarecimento/limitação, nunca uma resposta inventada.
5. Uma mudança no hash da planilha invalida a camada antiga, atualiza o painel aberto e passa a ser refletida no chat.
6. A resposta identifica versão/fonte, período e filtros usados, e distingue linhas inválidas ou cobertura parcial.

## Decisões ainda abertas

- Confirmar se o intervalo de atualização de cinco minutos é aceitável.
- Confirmar se as correções manuais de cliente atuais são a fonte oficial para cidade, UF, região e representante no chat.
- Confirmar como definir lucro/margem e valor médio de pedido antes de oferecer essas métricas.

## Aprovação

Abordagem escolhida em conversa: camada analítica determinística por versão, com agregações reutilizáveis e consultas compostas sob demanda. Este documento aguarda aprovação antes da implementação.
