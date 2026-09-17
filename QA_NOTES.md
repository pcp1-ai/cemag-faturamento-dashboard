# QA inicial

- Dev server respondeu HTTP 200 em `/` e `/data/tabelaFaturamento.csv`.
- A base padrão carregou no navegador com 1.200 linhas brutas e 588 linhas no filtro padrão `V ProdPrópria p Consumo`.
- Sidebar, período, formas de venda, exclusão de famílias, busca, filtros multidimensionais, KPIs, navegação por abas e gráficos iniciais renderizaram sem erro visual.
- Screenshot inicial salvo pelo browser em `/home/ubuntu/screenshots/localhost_2026-09-16_21-10-35_7857.webp`.
- Pontos funcionais para completar: ampliar a Inteligência Comercial para as oito subáreas originais, tornar as métricas selecionáveis efetivas nos gráficos, e reforçar a Central de Exportações com tabelas prontas/personalizadas e exportação multiaba.

## Validação funcional após implementação

A aplicação foi recarregada em `http://localhost:3000/` e manteve HTTP 200, carregamento de 1.200 linhas brutas e 588 linhas no filtro padrão. O DOM exibiu os oito controles da Inteligência Comercial: Comparador, Carteira & risco, ABC/Pareto, Mix & venda cruzada, Preço/margem & DRE, Calendário & ritmo, Representantes & alertas e Fechamento mensal. Cada subárea foi aberta sequencialmente e permaneceu renderizada.

A Central de Exportações também foi aberta no browser e exibiu os modos Tabelas prontas, Gerador personalizado e Base completa. Não foram observados erros de runtime da aplicação no console; houve apenas uma tentativa de JavaScript inválida durante o teste, corrigida na chamada seguinte.

## Metas mensais

Foi adicionada a aba **Metas mensais** com importação de CSV histórico (`mes;ano;meta`, aceitando também vírgula, nomes de meses e valores brasileiros), download de modelo, meta manual do mês vigente e persistência via `localStorage`. A meta manual tem prioridade sobre a meta importada para o mesmo mês. A análise mostra meta vigente, realizado, atingimento, projeção do mês e tabela mensal com diferença e status (`Atingida`, `Em andamento` ou `Não atingida`). A nova interface foi validada no browser; `pnpm check` e `pnpm build` passaram.

## Base padrão e mapa municipal

A aplicação agora verifica primeiro `localStorage` por uma base salva pelo usuário (`cemag_base_padrao`); se não existir, carrega `tabelaFaturamento.csv` embarcada. Todo CSV/XLSX enviado pelo controle **Substituir Planilha** passa a ser salvo automaticamente como a nova base padrão do navegador e será reutilizado na próxima abertura, até outro arquivo ser enviado.

A aba **Regiões** recebeu o **Mapa municipal de faturamento**, com bolhas dimensionadas pelo faturamento, posicionamento aproximado por UF, tooltip de faturamento/quantidade/pedidos/clientes e ranking dos municípios. A renderização foi validada no browser: `hasMap=true` e `hasRanking=true`. `pnpm check` e `pnpm build` passaram.

## Mapa municipal territorial

O mapa municipal esquemático foi substituído por um mapa coroplético baseado em GeoJSON real dos municípios brasileiros, com 5.570 geometrias carregadas offline. Os limites municipais ficam visíveis, municípios com vendas são coloridos conforme o faturamento, e o hover mostra município, UF, faturamento, quantidade, pedidos e clientes. A validação no browser confirmou `map=true` e `geojson=true`; `pnpm check` e `pnpm build` passaram.

## Mapa estadual territorial

O mapa dos estados também foi substituído pelo mapa coroplético baseado no GeoJSON estadual real. Os 27 estados possuem suas demarcações territoriais, preenchimento proporcional ao faturamento, tooltip com indicadores e ranking lateral. Validação no browser confirmou a renderização de `Distribuição territorial por estado`; `pnpm check` e `pnpm build` passaram.

## Foco do mapa municipal

O mapa municipal deixou de exibir o Brasil inteiro por padrão. Agora calcula automaticamente os estados que possuem vendas no filtro atual, mantém todos os municípios desses estados com suas demarcações e ajusta o enquadramento/escala ao bounding box da área relevante. A validação confirmou `hasMap=true`, `focused=true` e nenhum erro de pilha; `pnpm check` e `pnpm build` passaram.

## Drill-down estado → municípios

O mapa estadual agora aceita clique em cada polígono. Ao selecionar um estado, o painel municipal mostra somente os municípios daquele estado, ajusta o enquadramento territorial, mantém demarcações, cores, tooltip e ranking, e oferece o botão **Voltar aos estados**. Sem seleção, o painel municipal fica em estado vazio orientando o usuário a clicar em um estado. Teste no browser confirmou `detail=true`, `back=true` e `empty=false`; `pnpm check` e `pnpm build` passaram.

## Visualização expandida e painel lateral

Adicionados os controles **Ocultar filtros/Mostrar filtros** e **Expandir visualizações/Sair da visualização ampliada** no cabeçalho. O modo expandido ocupa a tela, aumenta a área vertical de gráficos e mapas e mantém o botão de saída fixo. Validação no browser confirmou `sidebarHidden=true`, `expanded=true` e `exit=true`; `pnpm check` e `pnpm build` passaram.

## Teste completo dos filtros

Foi executada uma bateria funcional no browser, restaurando os padrões entre os casos. Foram testados: data inicial, todas as formas de venda, forma de exportação, famílias excluídas, busca de produto, ano, região, UF, cidade, representante, lista de preço, cliente, cliente base, categoria, descrição genérica, grupo/modelo e família. Todos os controles responderam, alteraram a quantidade de linhas e não geraram erro. Também foi confirmado o retorno ao padrão final de `588 de 1.200` linhas.

Resultados principais: todas as formas `1.200`; exportação `817`; exclusão CBH `537`; busca FA `166`; ano 2024 `314`; Nordeste `180`; UF CE `50`; representante Sônia `217`; cliente DF-PLANES `53`; categoria FA 10000 `63`; Carreta Tanque `100`; grupo CBH `537`; família CBHM `503`. Os filtros de cidade, lista e cliente base também foram acionados sem erro.

## Correção do menu lateral ao abrir

O estado do painel lateral agora é persistido em `localStorage` (`cemag_sidebar_oculta`). Quando oculto, surge uma aba fixa vertical **Filtros** na borda esquerda para reabrir o menu, mesmo que o botão do cabeçalho não esteja visível. Teste no browser confirmou `hidden=true`, `fixedButton=true`, `reopened=true` e o botão do cabeçalho voltou a aparecer; `pnpm check` e `pnpm build` passaram.
