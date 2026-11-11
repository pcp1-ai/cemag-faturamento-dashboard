export type ChatDictionaryEntry = {
  canonical: string;
  aliases: string[];
  definition: string;
  fieldAliases: string[];
  ambiguityNote?: string;
  metricOperation?: "sum" | "average" | "countDistinct";
};

export const CHAT_BUSINESS_DICTIONARY: ChatDictionaryEntry[] = [
  { canonical: "faturamento_valor", aliases: ["faturamento", "faturado", "valor faturado", "venda", "vendas", "receita bruta", "total vendido"], definition: "Valor financeiro faturado registrado na base.", fieldAliases: ["faturamento", "valor", "valor total", "total", "valor faturado"], metricOperation: "sum" },
  { canonical: "quantidade_faturada", aliases: ["quantidade", "unidade faturada", "unidades faturadas", "quantidade vendida", "unidades vendidas", "volume vendido", "mais vendido", "mais vendida", "mais vendidos", "mais vendidas", "vendeu mais", "venderam mais"], definition: "Soma da quantidade nas linhas faturadas; não comprova produção física.", fieldAliases: ["quantidade", "qtd", "qtde", "quantidade faturada"], metricOperation: "sum" },
  { canonical: "representante", aliases: ["representante", "representantes", "vendedor", "vendedores", "consultor", "consultores", "consultor de vendas", "consultores de vendas", "comercial"], definition: "Pessoa ou equipe identificada como representante comercial na base.", fieldAliases: ["representante", "vendedor", "consultor", "comercial"] },
  { canonical: "cliente", aliases: ["cliente", "clientes", "comprador", "compradores", "adquirente", "adquirentes"], definition: "Cliente/comprador registrado na operação.", fieldAliases: ["cliente", "comprador", "nome cliente"], metricOperation: "countDistinct" },
  { canonical: "municipio", aliases: ["cidade", "cidades", "município", "municípios"], definition: "Município associado ao registro.", fieldAliases: ["cidade", "municipio", "município"] },
  { canonical: "uf", aliases: ["uf", "estado", "estados"], definition: "Unidade da Federação associada ao registro.", fieldAliases: ["uf", "estado", "unidade federativa"] },
  { canonical: "carreta", aliases: ["carreta", "carretas", "semirreboque", "semirreboques"], definition: "Categoria de produto Carreta, conforme classificação publicada.", fieldAliases: ["tipo_produto", "tipo produto", "categoria produto"], ambiguityNote: "Use apenas registros classificados como Carreta; não inclua automaticamente outros implementos." },
  { canonical: "implemento", aliases: ["implemento", "implementos", "implemento rodoviário", "implementos rodoviários"], definition: "Termo amplo para equipamento rodoviário; a base pode conter categorias diferentes.", fieldAliases: ["tipo_produto", "tipo produto", "categoria produto"], ambiguityNote: "Não é sinônimo exato de Carreta. Informe a ambiguidade ou peça a categoria quando necessário." },
  { canonical: "produto", aliases: ["produto", "produtos", "item", "itens"], definition: "Produto ou item conforme a coluna correspondente da base.", fieldAliases: ["produto", "item", "agrupamento", "1o. agrupamento"] },
  { canonical: "modelo", aliases: ["modelo", "modelos"], definition: "Modelo de produto, se houver campo próprio na base.", fieldAliases: ["modelo", "nome modelo"] },
  { canonical: "familia", aliases: ["família", "famílias", "familia", "familias", "grupo de produto", "grupo modelo"], definition: "Família/grupo de produtos conforme coluna da base.", fieldAliases: ["familia", "família", "grupo_modelo", "grupo"] },
  { canonical: "regiao", aliases: ["região", "regiões", "regiao", "regioes"], definition: "Região comercial associada ao registro.", fieldAliases: ["regiao", "região"] },
  { canonical: "tipo_venda", aliases: ["forma de venda", "formas de venda", "tipo de venda", "tipo venda", "modalidade de venda"], definition: "Forma ou tipo de venda registrado.", fieldAliases: ["tipo_venda", "tipo venda", "forma de venda"] },
  { canonical: "cor", aliases: ["cor", "cores"], definition: "Cor registrada para o produto.", fieldAliases: ["cor"] },
  { canonical: "grupo_modelo", aliases: ["grupo modelo", "grupo de modelo", "grupo de modelos"], definition: "Grupo de modelo, conforme campo próprio da base.", fieldAliases: ["grupo_modelo", "grupo modelo"] },
  { canonical: "lista_preco_uf", aliases: ["lista de preço", "lista de preços", "tabela de preço", "tabela de preços", "lista preço uf"], definition: "Lista de preço associada à UF, se disponível.", fieldAliases: ["lista_preco_uf", "lista preço uf", "lista de preço"] },
  { canonical: "descricao_generica", aliases: ["descrição genérica", "descricao generica", "descrições genéricas"], definition: "Descrição genérica de produto registrada.", fieldAliases: ["descricao_generica", "descrição genérica"] },
  { canonical: "pedido", aliases: ["pedido", "pedidos", "quantidade de pedidos", "número de pedidos", "ordem de venda", "número do pedido"], definition: "Pedido ou documento comercial registrado.", fieldAliases: ["pedido", "numero pedido", "ordem", "documento"], metricOperation: "countDistinct" },
  { canonical: "custo", aliases: ["custo", "custos", "custo total", "valor de custo"], definition: "Custo registrado na linha da base.", fieldAliases: ["custo"], metricOperation: "sum" },
  { canonical: "frete", aliases: ["frete", "fretes", "valor do frete"], definition: "Valor de frete registrado na linha da base.", fieldAliases: ["frete"], metricOperation: "sum" },
  { canonical: "impostos_principais", aliases: ["impostos principais", "tributos principais"], definition: "Soma de impostos principais conforme campo calculado na base.", fieldAliases: ["impostos_principais", "impostos principais"], metricOperation: "sum" },
  { canonical: "tributos_dre", aliases: ["tributos", "tributos da dre", "impostos da dre"], definition: "Tributos contabilizados no campo DRE da base.", fieldAliases: ["tributos_dre", "tributos dre"], metricOperation: "sum" },
  { canonical: "faturamento_liquido_aprox", aliases: ["faturamento líquido aproximado", "faturamento líquido", "valor líquido aproximado"], definition: "Estimativa de faturamento líquido calculada pelo dashboard.", fieldAliases: ["faturamento_liquido_aprox", "faturamento líquido aproximado"], metricOperation: "sum" },
  { canonical: "ticket_unitario", aliases: ["ticket unitário", "ticket médio unitário", "preço médio unitário"], definition: "Ticket/preço unitário registrado ou calculado na linha.", fieldAliases: ["ticket_unitario", "ticket unitário"], metricOperation: "average" },
  { canonical: "lucro", aliases: ["lucro", "lucros", "margem", "rentabilidade"], definition: "Lucro ou margem; não equivale a faturamento.", fieldAliases: ["lucro", "margem", "rentabilidade"], metricOperation: "sum", ambiguityNote: "Só pode ser calculado se houver dados de custos e uma definição explícita. Não inferir a partir do faturamento." },
];

export function normalizarTermoChat(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

export function resolveChatTerm(input: string): { canonical: string; matchedAlias: string } | null {
  const normalizedInput = ` ${normalizarTermoChat(input)} `;
  const aliases = CHAT_BUSINESS_DICTIONARY.flatMap((entry) => entry.aliases.map((alias) => ({ canonical: entry.canonical, alias, normalized: normalizarTermoChat(alias) })))
    .sort((a, b) => b.normalized.length - a.normalized.length);
  const match = aliases.find(({ normalized }) => normalized && normalizedInput.includes(` ${normalized} `));
  return match ? { canonical: match.canonical, matchedAlias: match.alias } : null;
}
