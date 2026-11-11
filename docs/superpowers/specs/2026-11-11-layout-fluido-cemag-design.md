# Proposta de layout fluido para o painel CEMAG

## Objetivo

Tornar o painel mais fácil de navegar e mais confortável para leitura, preservando o modo escuro, a identidade CEMAG e os recursos e cálculos atuais.

## O que existe hoje

- O cabeçalho reúne marca, ações de relatório, tema, filtros, expansão, padrões e exportação.
- A navegação ocupa duas fileiras acima do conteúdo.
- Os filtros ficam numa coluna fixa e estreitam a área dos gráficos.
- Os cartões e gráficos usam tons escuros e laranja, com pequenas variações de cor e estilo.

## Abordagens consideradas

1. **Refino visual:** manter a estrutura e padronizar cores, cartões, espaçamentos e gráficos. É a opção de menor impacto, mas deixa os principais problemas de navegação e espaço.
2. **Reorganização do painel (recomendada):** simplificar o cabeçalho, agrupar a navegação principal, recolher os filtros quando não estiverem em uso e dar mais hierarquia à Visão Geral. Exige mudanças maiores na disposição, mas responde diretamente à falta de espaço e à concentração de controles.

## Direção escolhida

Aplicar a segunda abordagem, começando pelo cabeçalho, navegação e tela Visão Geral. A navegação deve permanecer compreensível em telas menores. A coluna de filtros poderá ser aberta ou recolhida sem perder os filtros já selecionados.

## Identidade e movimento

- Manter o modo escuro como aparência padrão e preservar o laranja CEMAG para ações e destaques.
- Unificar as cores em torno de superfícies grafite, texto claro e acentos da marca; evitar cores decorativas concorrendo com os gráficos.
- Usar transições curtas e suaves ao abrir filtros, trocar seções e destacar controles. Respeitar `prefers-reduced-motion` e evitar animações que atrasem o acesso aos dados.

## Limites

- Não alterar cálculos, conteúdo analítico, filtros disponíveis, permissões ou fluxo de dados.
- Não remover indicadores nem funcionalidades existentes.
- Não redesenhar as telas de login ou de impressão nesta etapa.

## Critério de conclusão

O usuário consegue identificar a seção atual, abrir e fechar filtros, acessar as ações principais sem um cabeçalho congestionado e ler os indicadores em desktop e celular, sempre no modo escuro.
