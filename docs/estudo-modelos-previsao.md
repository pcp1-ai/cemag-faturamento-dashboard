# Estudo e adaptação dos modelos de previsão

## Decisão para a primeira versão

Foi adicionada uma opção chamada **Híbrido inspirado no TCC**. Ela combina uma projeção de tendência e sazonalidade com uma regressão ridge dos fatores externos mensais disponíveis. O peso da regressão é estimado por previsões retroativas: em cada origem, o cálculo só enxerga dados anteriores. A combinação só usa fatores se a regressão tiver cobertura suficiente e reduzir o WAPE em relação à tendência sazonal no mesmo conjunto de meses.

Fatores considerados nesta versão:

- Selic mensal do Banco Central;
- chuva mensal quando a cidade e a UF consultadas coincidem com a carteira de vendas filtrada;
- crédito rural mensal do BCB/SICOR, somado apenas para as UFs presentes na carteira e cobertas pela consulta;
- ANFAVEA: máquinas agrícolas autopropulsadas no atacado, varejo e exportações, usando o total agrícola mensal.

Os fatores são deslocados em um mês. Chuva só participa se a carteira filtrada corresponder a uma cidade e UF iguais às da consulta climática; isso evita aplicar a chuva de uma cidade à carteira nacional ou a outra região. Para o futuro, a primeira projeção usa o último mês externo observado; as projeções seguintes mantêm esse último valor, pois o sistema ainda não possui uma série mensal de previsões futuras para todos esses indicadores. Assim, não se usa o valor realizado de uma variável externa que ainda não existia na data simulada. Variáveis com cobertura insuficiente ficam fora do ajuste; se não houver dados externos comparáveis, o híbrido retorna à tendência sazonal.

## O que o TCC recomenda e o que foi adaptado

O trabalho anexado estudou uma indústria de implementos agrícolas e comparou LightGBM, GRU e Prophet, além de combinações entre eles. Usou validação temporal, métricas MAE e WAPE, combinação ponderada e ajuste qualitativo de especialistas. A base descrita tinha 79 observações mensais por combinação de família e região, com dados internos e indicadores externos.

Essa metodologia é relevante para a CEMAG, mas os resultados numéricos do TCC não podem ser transferidos diretamente. A quantidade de observações por série, as famílias, as regiões, a forma de faturamento e o horizonte diferem. Também não há no aplicativo atual um runtime de LightGBM, GRU ou Prophet: a previsão é calculada em TypeScript no navegador. Por isso, o modelo novo preserva o procedimento principal do TCC — comparação temporal, combinação ponderada e uso condicional de fatores externos — com regressão ridge, que cabe no ambiente atual e tem poucos parâmetros. A interface identifica explicitamente essa adaptação.

## Avaliação dos candidatos

| Família de modelo | Onde pode ajudar | Limite para a CEMAG | Recomendação |
|---|---|---|---|
| Sazonal ingênuo e médias | Referências simples, rápidas e difíceis de superar em séries estáveis | Não incorporam causas externas e podem reagir devagar a mudanças | Manter como referências e comparadores |
| Tendência, regressão sazonal e ETS | Séries mensais com tendência e sazonalidade; poucos parâmetros e interpretação clara | Podem errar em mudanças abruptas, grandes contratos ou rupturas de mercado | Usar como base e benchmark principal |
| Prophet | Tendência, sazonalidade, feriados e regressores conhecidos no horizonte | Todo regressor precisa ter valor futuro ou uma projeção própria; ajuste de sazonalidade também pode superajustar séries curtas | Avaliar após fornecer previsões futuras consistentes dos fatores |
| LightGBM com defasagens e variáveis de calendário | Relações não lineares e várias séries relacionadas, com dados tabulares suficientes | Pode aprender ruído quando há poucos meses por segmento; exige seleção de defasagens e backtest cuidadoso | Testar em lote quando houver painel de séries maior e histórico limpo |
| GRU / redes recorrentes | Padrões sequenciais complexos e aprendizado conjunto entre muitas séries | Muitos graus de liberdade para poucas observações mensais por série; maior custo e risco de instabilidade | Não usar como primeira escolha isolada; só experimentar com muitas séries e regularização |
| Combinação de previsões | Reduz dependência de um único modelo quando erros são diferentes | Pesos estimados com poucos pontos podem ficar instáveis | Combinar somente após backtest comparável e limitar o peso dos componentes |

Concursos de previsão em grande escala mostram que métodos estatísticos e combinações são benchmarks fortes. Isso não significa que um híbrido sempre vence: a seleção precisa ser medida nas séries, segmentos e horizontes reais da empresa. A regra aqui é conservar o modelo-base se o componente externo não melhorar o erro no backtest.

## Como comparar os modelos daqui em diante

1. Agregar a planilha em meses completos e preencher meses sem venda com zero dentro do período observado.
2. Separar treino e avaliação por tempo. Em cada origem, recalcular os parâmetros apenas com o passado e prever o mês ou horizonte seguinte.
3. Reportar WAPE e MAE; MAPE fica como métrica complementar porque explode ou fica indefinido quando o realizado é zero ou muito baixo.
4. Comparar por métrica, horizonte e carteira filtrada, sem presumir que o melhor modelo geral seja o melhor para cada segmento.
5. Manter um modelo simples de referência. Só promover um modelo mais complexo quando ele melhorar o erro fora da amostra de forma consistente.
6. Para os fatores externos, guardar a data de publicação/consulta e, numa etapa futura, usar vintages históricas. Sem isso, um backtest pode usar revisões que não estavam disponíveis na data da previsão.
7. Criar previsões futuras dos fatores (ou cenários explícitos) antes de pedir a Prophet, LightGBM ou qualquer regressão que dependa de regressores futuros para antecipar seus valores realizados.

Os intervalos conservador e otimista atuais são cenários simplificados baseados no erro agregado. Eles ainda não são intervalos probabilísticos calibrados; numa próxima etapa, podem ser substituídos por quantis de erros de backtest por horizonte.

## Referências

- TCC anexado: *Proposta e implantação de uma solução de previsão de demanda em uma indústria de implementos agrícolas*, UFC, 2025.
- Hyndman e Athanasopoulos, [time-series cross-validation / rolling forecast origin](https://otexts.com/fpp3/tscv.html).
- Makridakis, Spiliotis e Assimakopoulos, [The M4 Competition: 100,000 time series and 61 forecasting methods](https://doi.org/10.1016/j.ijforecast.2019.04.014).
- Taylor e Letham, [Prophet: forecasting at scale](https://peerj.com/preprints/3190/), incluindo a necessidade de valores futuros para regressoras externas.
- Ke et al., [LightGBM: A Highly Efficient Gradient Boosting Decision Tree](https://proceedings.neurips.cc/paper/2017/hash/6449f44a102fde848669bdd9eb6b76fa-Abstract.html).
- Cho et al., [Learning Phrase Representations using RNN Encoder-Decoder](https://arxiv.org/abs/1406.1078), trabalho de origem da unidade GRU.
- Granger e Newbold, [Forecasting and the evaluation and combination of forecasts](https://fraser.stlouisfed.org/files/docs/historical/frbny/researchpapers/frbny_researchpapers_9525.pdf).

## Modelo CEMAG adaptativo

Foi incluído um terceiro modo, independente do híbrido inspirado no TCC. “Próprio” aqui significa uma regra de decisão construída para as séries mensais e os filtros deste painel; os componentes estatísticos têm base na literatura e não são apresentados como uma técnica inédita.

### Por que outro modelo

O sistema não prevê uma única série corporativa fixa. A carteira muda conforme filtros de forma de venda, produto, região, cliente, representante e período. Ao agregar a carteira filtrada por mês, meses sem venda aparecem como zero. Uma média ou reta calculada nesses zeros pode diluir uma demanda que ocorre em poucos meses; por outro lado, em vendas regulares, um método de demanda intermitente pode ignorar tendência e calendário. Por isso, um único método rígido não é apropriado para todas as seleções.

O modelo classifica o trecho recente de até 24 meses, sempre apenas com os dados disponíveis em cada origem de previsão:

- **Demanda intermitente:** pelo menos 12 meses, 4 meses com venda e 35% ou mais de meses zerados. Usa Croston SBA para suavizar separadamente o tamanho da venda e o intervalo entre vendas. Escolhe o parâmetro de suavização entre 0,1, 0,2, 0,3 e 0,5 pelo menor WAPE de um passo à frente dentro do treino.
- **Demanda mais regular:** calcula fatores por mês do ano com medianas, reduz a intensidade sazonal quando há poucas repetições e limita fatores extremos. Remove esse padrão sazonal e estima a inclinação pelo Theil–Sen (mediana das inclinações entre pares), que é menos sensível a um contrato excepcional do que a regressão linear comum. A tendência futura é amortecida com fator 0,8 por passo.

O limiar de 35%, o mínimo de 12 meses/4 ocorrências e o amortecimento são escolhas iniciais explícitas para evitar trocar de família por poucos zeros ou extrapolar indefinidamente um pico. São parâmetros de engenharia, ainda não calibrados com avaliação operacional da CEMAG. No modo **Automático**, o erro do CEMAG é comparado com referências simples em origens recentes; o CEMAG só é escolhido quando reduz o WAPE nesse recorte. Também pode ser selecionado diretamente.

### Comparação e métricas

A tela apresenta Automático, Híbrido do TCC e CEMAG adaptativo usando o mesmo período de origens de previsão. WAPE e MAE contam também meses realizados em zero, porque uma previsão positiva nesses meses é erro real. MAPE continua excluindo zeros, por ser indefinido nesses casos. A quantidade de meses da comparação é exibida junto das métricas.

Isso é uma validação rolling-origin de um mês à frente nos até 12 meses mais recentes, não uma garantia de acerto em todos os horizontes de 3, 6 ou 12 meses. A classificação e o ajuste são refeitos dentro de cada janela, sem consultar o mês previsto. O gráfico retroativo e a comparação são evidências para esta carteira/filtro; quando poucos meses têm venda, WAPE e MAPE podem oscilar bastante.

### Limites conhecidos e próximos passos

- O CEMAG adaptativo não usa fatores externos. Isso é intencional: ANFAVEA, clima, crédito e Selic podem ajudar como contexto, mas o sistema não tem previsões futuras/vintages históricas consistentes de todas essas séries para cada região. O híbrido do TCC continua disponível para avaliar esse uso condicional.
- A série agregada de faturamento pode esconder produtos ou clientes com padrões diferentes. Uma próxima evolução robusta deve comparar séries hierárquicas (total, famílias, regiões) e reconciliar previsões, sem somar duas vezes as mesmas vendas.
- A regra atual gera uma estimativa pontual. As faixas conservadora e otimista ainda são cenários multiplicativos com erro agregado, não intervalos probabilísticos calibrados por horizonte.
- Para decisões de estoque, o nível mensal médio do SBA não informa sozinho a probabilidade, o tamanho da próxima venda nem o prazo de reposição. Isso exigiria previsões probabilísticas e dados de lead time/estoque.
- A tabela de validação é calculada no navegador sobre a carteira filtrada. Antes de chamar qualquer modelo de “melhor”, a CEMAG deve observar seus resultados em várias carteiras e períodos e comparar erros por horizonte, WAPE/MAE e viés (super ou subprevisão).

### Referência adicional

- Syntetos e Boylan, [The accuracy of intermittent demand estimates](https://doi.org/10.1016/j.ijforecast.2004.10.001), que apresenta a aproximação SBA e a compara com métodos de demanda intermitente em séries reais.
