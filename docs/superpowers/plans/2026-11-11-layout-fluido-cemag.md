# Layout fluido CEMAG — plano de implementação

> **Execução:** implementação direta nesta sessão seguindo `superpowers:executing-plans`.

**Objetivo:** reorganizar o cabeçalho, os filtros e a navegação para deixar o painel escuro mais simples de percorrer, com transições suaves e sem alterar dados ou cálculos.

**Arquitetura:** manter React, Tailwind e os componentes atuais. Tornar os filtros um drawer sobreposto que abre sob demanda; consolidar as ações do cabeçalho em ações principais e um menu secundário; padronizar os destaques com grafite e laranja CEMAG. Aplicar movimento apenas em navegação, abertura e estados interativos.

**Stack:** React, TypeScript, Tailwind CSS, Lucide.

**Design:** `docs/superpowers/specs/2026-11-11-layout-fluido-cemag-design.md`.

## Restrições

- Preservar modo escuro, funcionalidades, permissões, filtros, cálculos e conteúdo.
- Filtros fechados por padrão, abertos ao clicar em “Filtros”; fechar não limpa seleções.
- Respeitar `prefers-reduced-motion` e manter animações curtas (até 220 ms).
- Manter navegação acessível por teclado e utilizável em celular.
- Não alterar login, relatório impresso ou dados.

## Foco de revisão

- Drawer fechado não pode bloquear cliques nem capturar foco.
- Fechar e reabrir filtros conserva os valores selecionados.
- Menu de ações secundárias fecha ao escolher uma ação e não cobre o conteúdo sem necessidade.
- Em celular, cabeçalho e navegação não podem criar rolagem horizontal da página inteira.
- Movimento reduzido remove transições e animações não essenciais.

### Tarefa 1: Simplificar o cabeçalho e agrupar ações

**Arquivos:** `client/src/pages/Home.tsx`.

**Interface:** manter os mesmos handlers para tema, filtros, expansão, padrões, exportação, impressão e saída. Adicionar um menu acessível de ações secundárias para manter essas funções sem exibir todos os botões juntos.

- [x] Separar marca/título das ações de trabalho.
- [x] Deixar “Filtros” e “Exportar” visíveis como ações principais; agrupar tema, expansão, restaurar padrões, relatório e sair em um menu secundário.
- [x] Exibir a seção atual e o resumo de período/base numa faixa compacta abaixo do cabeçalho.
- [x] Verificar `npm.cmd run check`.

### Tarefa 2: Transformar filtros em painel sobreposto recolhível

**Arquivos:** `client/src/pages/Home.tsx`, `client/src/components/SidebarFilters.tsx`.

**Interface:** manter os campos e handlers atuais de `SidebarFilters`; alterar apenas abertura, fechamento e apresentação responsiva.

- [x] Fechar filtros por padrão quando não houver preferência salva.
- [x] Manter o drawer e o backdrop montados durante a transição, sem permitir interação quando fechados.
- [x] Fechar pelo botão, backdrop e tecla Escape; manter os valores dos filtros ao reabrir.
- [x] Usar o mesmo padrão de interação em desktop e celular.
- [x] Verificar `npm.cmd run check`.

### Tarefa 3: Unificar a linguagem visual e suavizar transições

**Arquivos:** `client/src/index.css`, `client/src/components/MetricCards.tsx`, `client/src/pages/Home.tsx`.

- [x] Definir cores de superfície, borda, texto e laranja de marca em tokens do painel escuro.
- [x] Reduzir cores decorativas dos cartões principais sem remover informação ou distinções semânticas.
- [x] Adicionar transições curtas de abertura/fechamento, navegação e foco.
- [x] Desativar transições e animações não essenciais em `prefers-reduced-motion: reduce`.
- [x] Verificar `npm.cmd run check` e `npm.cmd run build`.

### Tarefa 4: Revisar o resultado e publicar

**Arquivos:** os três arquivos de interface acima.

- [x] Conferir o diff para garantir que não houve mudança em dados, cálculos ou funcionalidades.
- [x] Rodar `npm.cmd run check`, `npm.cmd run build` e `git diff --check`.
- [x] Fazer commit e push para `main`, depois confirmar o status do Vercel.
