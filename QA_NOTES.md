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
