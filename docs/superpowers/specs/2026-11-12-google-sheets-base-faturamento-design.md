# Base de faturamento lida do Google Sheets

## Objetivo

Usar a aba `tabelaFaturamento` da planilha `análise faturamento/dre` como fonte única da base de faturamento do painel e do chat, sem exigir TiDB para esses dados e sem escrever na planilha.

## Fonte e estrutura confirmadas

- Planilha: `10ZmbMXx4ePOBZkJElfj-5aLQiR-3Npt2LEHDE-iWgc0`.
- Aba: `tabelaFaturamento` (`sheetId` `404364337`).
- Cabeçalho confirmado de A:AE: `1o. Agrupamento`, `VRA_CLASSE.CLASSERECURSO`, `BAI_PESSOA.CODIGO`, `BAI_RECURSO.DESCRICAOGENERICA`, `BAI_RECURSO.CLASSE.NOME`, `BAI_QUANTIDADE`, `BAI_EMISSAO`, `BAI_MOVIMENTAC`, `BAI_CLASSE.NOME`, `BAI_NUMERO`, `BAI_CUSTOCONT`, `BAI_TOTAL`, `BAI_CHCRIACAO`, `BAI_FRETE`, `BAI_IPI`, `BAI_PIS`, `BAI_COFINS`, `BAI_ISS`, `BAI_IR`, `BAI_INSS`, `BAI_II`, `BAI_ICMS`, `BAI_ACESSORI0`, `BAI_ACESSORI1`, `CIDADE`, `CIDADE+ ESTADO`, `REPRESENTANTE`, `LISTA DE PREÇO UF`, coluna vazia, `MêS`, `ANO`.
- A conta de serviço guardada localmente conseguiu autenticar e ler os metadados e cabeçalhos dessa planilha.

## Desenho proposto

1. O servidor autentica com a conta de serviço e chama a API do Google Sheets. A chave privada nunca vai ao navegador nem ao repositório.
2. O servidor lê somente A:AE da aba, usa a primeira linha como cabeçalho, ignora a coluna sem nome e mantém os nomes originais das demais colunas.
3. A base carregada fica em cache de memória por cinco minutos por instância do servidor. Em falha de leitura sem cache, a API informa erro; não apresenta silenciosamente o CSV antigo como se estivesse atualizado.
4. As consultas atuais do painel, paginação e chat passam a usar esse provedor de dados. O tratamento atual continua usando `BAI_MOVIMENTAC` com fallback para `BAI_EMISSAO`; `MêS` e `ANO` permanecem disponíveis na linha bruta.
5. A publicação de CSV pelo painel deixa de ser uma segunda fonte de verdade; a atualização passa a ocorrer editando a planilha. Nenhuma operação de escrita é feita na planilha pelo dashboard.
6. As variáveis da conta de serviço, o ID da planilha e o nome da aba ficam em variáveis de ambiente locais ignoradas pelo Git e em variáveis secretas do Vercel. O acesso do serviço à planilha deve ser somente de leitura.

## Fora do escopo

- Alterar, formatar ou inserir dados na planilha.
- Migrar usuários, metas ou outros dados auxiliares do painel.
- Remover a integração TiDB da conta Vercel. A leitura da base de faturamento não dependerá dela; qualquer limpeza externa será feita separadamente.

## Critérios de aceite

- Todos os usuários autenticados consultam a mesma aba privada por meio do servidor.
- Os filtros e métricas reconhecem os nomes de coluna confirmados acima e mantêm o cálculo atual de datas e valores.
- O chat consulta a mesma versão/cache de dados usada pelo painel.
- Nenhuma chave privada aparece no bundle do navegador, em logs ou em arquivos rastreados pelo Git.
- Se o Google Sheets estiver indisponível e não houver cache válido, o usuário recebe erro claro em vez de dados antigos apresentados como atuais.

## Implementacao e configuracao

- O backend le `tabelaFaturamento!A1:AE` com escopo somente de leitura e cache de cinco minutos por instancia.
- O painel e o chat recebem a mesma versao da planilha. A publicacao de CSV pelo painel e o fallback para o CSV legado foram removidos.
- Configure no ambiente local ignorado pelo Git e nas variaveis de Production, Preview e Development do Vercel: `GOOGLE_SPREADSHEET_ID`, `GOOGLE_SHEET_NAME`, `GOOGLE_CLIENT_EMAIL` e `GOOGLE_PRIVATE_KEY`. `GOOGLE_TOKEN_URI` e opcional; o servidor usa o endpoint OAuth padrao do Google quando omitido.
- A etapa de build ignora migracoes TiDB quando `GOOGLE_SPREADSHEET_ID` esta configurado. Nenhuma configuracao externa do Vercel foi alterada nesta implementacao.