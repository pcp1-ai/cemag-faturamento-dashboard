# Chat com consulta à base completa — Design

## Objetivo

Permitir que pessoas autenticadas perguntem ao assistente sobre qualquer dado comercial existente na base compartilhada publicada e sobre análises derivadas exibidas pelo dashboard. Respostas devem consultar a base inteira e independem dos filtros visuais ativos.

## Abordagens consideradas

1. Enviar mais resumos prontos no contexto do LLM: simples, mas rankings e períodos continuam limitados e perguntas inesperadas podem falhar.
2. Consultar a base persistida no servidor a cada pergunta, selecionar/calcular apenas os dados relevantes e enviar esse resultado ao LLM: escolhido por cobrir linhas, colunas, períodos e combinações sem exceder o limite de contexto.

## Comportamento e arquitetura

- O servidor usa a versão publicada atual da base compartilhada; não confia nos filtros ou resumos enviados pelo navegador como fonte da verdade.
- Consultas são somente leitura e cobrem os registros e dimensões disponíveis, com busca e agregações por período, produto, família, cliente, representante, região, UF e cidade, além das outras colunas publicadas.
- O modelo recebe resultados da consulta, definições das métricas e o contexto da pergunta, nunca uma promessa de que pode adivinhar dados ausentes. Rankings truncados e janelas fixas não podem ser tratados como a base completa.
- Respostas informam o período e o critério usados; se não houver correspondência, dizem isso claramente. Quantidade faturada não deve ser descrita como produção física.
- Dados adicionais mostrados pelo dashboard (por exemplo, metas locais, previsões e consultas externas) só entram na resposta quando estiverem disponíveis no contexto da sessão ou persistidos no servidor; a resposta identifica a fonte e não os confunde com a planilha comercial.
- O endpoint permanece protegido por autenticação. A consulta não altera a base nem publica arquivos.

## Dicionário de negócios e associações

- Manter um dicionário central e estruturado de termos usados pelas pessoas, associações canônicas, definições e ressalvas. Ele não duplica os registros da planilha; traduz vocabulário para campos, métricas e categorias que existem na base.
- Alimentar com ele tanto a resolução determinística das perguntas quanto as instruções do modelo, para que ambos usem as mesmas definições.
- Incluir termos gerais e variantes como vendedor/consultor/representante → representante; cidade/município → município; faturamento/valor faturado → métrica de valor; unidades vendidas/mais vendida → quantidade faturada.
- Não assumir equivalência em termos ambíguos: “lucro” não é faturamento; “implemento” é mais amplo que “carreta”; produto, modelo, família e agrupamento podem ser dimensões distintas. Usar os valores e colunas publicados e declarar ou perguntar quando o mapeamento não for seguro.
- Incluir apelidos e siglas específicos da CEMAG somente quando confirmados por valores da base ou por definição do administrador; não inferir que todos os termos encontrados na web sejam sinônimos do negócio.

## Sugestões de perguntas contextuais

- Após cada resposta com dados suficientes, oferecer até três perguntas de continuação curtas, em botões ou sugestões clicáveis junto à resposta.
- Gerar sugestões a partir da pergunta, resposta, dimensões e período consultados e do dicionário; por exemplo, após um ranking por representante, sugerir comparar com período anterior, detalhar produtos ou abrir por município.
- Cada sugestão precisa ser respondível pela base e, ao ser selecionada, deve fazer uma nova consulta real. Não sugerir resultados nem fatos que ainda não foram calculados.
- Se a resposta for inconclusiva ou a consulta falhar, não oferecer sugestões que pressuponham dados inexistentes.

## Limites

- O chat responde sobre os dados e conteúdos disponibilizados pelo próprio sistema; não busca fatos externos arbitrários.
- Metas guardadas apenas no `localStorage` de um navegador não são uma fonte compartilhada. Elas só podem ser usadas quando o contexto atual as fornecer, e devem ser identificadas como locais.
- Se a base publicada estiver indisponível, o assistente deve informar que não conseguiu consultar a fonte; não deve silenciosamente recorrer a um resumo parcial e apresentá-lo como completo.

## Restrições e decisões

- Preservar o histórico curto de conversa atual e a interface existente.
- Usar a base analítica persistida existente e as rotinas de banco atuais; evitar enviar milhares de linhas ao modelo e evitar dependências novas.
- A conta autenticada define acesso; usuários consultam, administradores continuam sendo os únicos que publicam a base.

## Aprovação

Abordagem aprovada pelo usuário: consultar a base inteira como padrão, independentemente dos filtros selecionados. O usuário também solicitou um dicionário central de associações de termos e sugestões de perguntas contextuais. Falta aprovar o escopo completo deste documento antes de planejar e alterar a implementação.
