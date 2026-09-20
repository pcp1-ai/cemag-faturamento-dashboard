import React, { useRef, useState } from "react";
import { Upload, X, Filter, RotateCcw, Search, CheckSquare, Square } from "lucide-react";

export interface FiltrosState {
  dataInicio: string;
  dataFim: string;
  considerarTodasFormas: boolean;
  tiposVendaSelecionados: string[];
  familiasExcluidas: string[];
  anos: number[];
  regioes: string[];
  ufs: string[];
  cidades: string[];
  representantes: string[];
  listasPreco: string[];
  clientes: string[];
  clientesBase: string[];
  categorias: string[];
  descricoesGenericas: string[];
  gruposModelo: string[];
  familias: string[];
  tiposProduto: string[];
  buscaProduto: string;
}

interface SidebarFiltersProps {
  filtros: FiltrosState;
  setFiltros: React.Dispatch<React.SetStateAction<FiltrosState>>;
  opcoesFiltros: {
    tiposVenda: string[];
    familias: string[];
    anos: number[];
    regioes: string[];
    ufs: string[];
    cidades: string[];
    representantes: string[];
    listasPreco: string[];
    clientes: string[];
    clientesBase: string[];
    categorias: string[];
    descricoes: string[];
    gruposModelo: string[];
    tiposProduto: string[];
  };
  nomeArquivoBase: string;
  onUploadArquivo: (file: File) => void;
  isAdmin: boolean;
  onResetFiltros: () => void;
  linhasFiltradas: number;
  totalLinhasValidas: number;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const SidebarFilters: React.FC<SidebarFiltersProps> = ({
  filtros,
  setFiltros,
  opcoesFiltros,
  nomeArquivoBase,
  onUploadArquivo,
  isAdmin,
  onResetFiltros,
  linhasFiltradas,
  totalLinhasValidas,
  isOpenMobile,
  onCloseMobile,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [buscasFiltros, setBuscasFiltros] = useState<Record<string, string>>({});

  const buscaDoFiltro = (key: string) => buscasFiltros[key] || "";
  const atualizarBuscaFiltro = (key: string, value: string) =>
    setBuscasFiltros((prev) => ({ ...prev, [key]: value }));

  const toggleArrayItem = (key: keyof FiltrosState, item: any) => {
    setFiltros((prev) => {
      const arr = (prev[key] as any[]) || [];
      const exists = arr.includes(item);
      const novoArr = exists ? arr.filter((x) => x !== item) : [...arr, item];
      return { ...prev, [key]: novoArr };
    });
  };

  const limparCampo = (key: keyof FiltrosState) => {
    setFiltros((prev) => ({ ...prev, [key]: [] }));
  };

  const selecionarTudo = (key: keyof FiltrosState, opcoes: (string | number)[]) => {
    setFiltros((prev) => ({ ...prev, [key]: [...opcoes] }));
  };

  const renderMultiSelect = (
    label: string,
    key: keyof FiltrosState,
    opcoes: (string | number)[],
    limiteExibicao: number = 80
  ) => {
    const selecionados = (filtros[key] as any[]) || [];
    const busca = buscaDoFiltro(String(key));
    const opcoesFiltradas = busca.trim()
      ? opcoes.filter((op) => String(op).toLocaleLowerCase().includes(busca.trim().toLocaleLowerCase()))
      : opcoes;
    const opcoesVisiveis = opcoesFiltradas.slice(0, limiteExibicao);

    return (
      <div className="space-y-1 text-xs">
        <div className="flex items-center justify-between gap-2 text-slate-300 font-medium">
          <span>{label}</span>
          <div className="flex items-center gap-2">
            {opcoes.length > 0 && <button type="button" onClick={() => selecionarTudo(key, opcoes)} className="text-[10px] text-sky-400 hover:text-sky-300 transition-colors">Selecionar tudo</button>}
            {selecionados.length > 0 && <button type="button" onClick={() => limparCampo(key)} className="text-[10px] text-orange-400 hover:text-orange-300 transition-colors">Limpar seleção</button>}
          </div>
        </div>
        {opcoes.length > 5 && (
          <div className="relative">
            <input
              type="search"
              value={busca}
              onChange={(e) => atualizarBuscaFiltro(String(key), e.target.value)}
              placeholder={`Buscar ${label.toLowerCase()}...`}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded pl-7 pr-2 py-1 text-[11px] focus:ring-1 focus:ring-orange-500"
            />
            <Search className="w-3 h-3 text-slate-500 absolute left-2 top-2" />
          </div>
        )}
        <div className="max-h-32 overflow-y-auto bg-slate-900/90 border border-slate-800 rounded p-1.5 space-y-1 text-slate-200">
          {opcoesVisiveis.map((op) => {
            const isChecked = selecionados.includes(op);
            return (
              <label
                key={String(op)}
                className="flex items-center gap-1.5 p-1 rounded hover:bg-slate-800/80 cursor-pointer select-none text-[11px]"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleArrayItem(key, op)}
                  className="rounded border-slate-700 text-orange-500 focus:ring-orange-500 bg-slate-800"
                />
                <span className="truncate">{String(op)}</span>
              </label>
            );
          })}
          {opcoesFiltradas.length === 0 && busca.trim() && (
            <div className="text-[10px] text-slate-500 p-1">Nenhuma opção encontrada</div>
          )}
          {opcoes.length === 0 && (
            <div className="text-[10px] text-slate-500 p-1">Nenhuma opção disponível</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Backdrop mobile */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed lg:static top-0 left-0 h-full lg:h-auto w-80 bg-[#0E131F] border-r border-slate-800 z-50 lg:z-auto flex flex-col transition-transform duration-200 shadow-2xl lg:shadow-none overflow-hidden lg:overflow-visible ${
          isOpenMobile ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Topo da barra lateral */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-orange-500" />
            <h2 className="font-bold text-sm text-white tracking-wide uppercase">
              Painel de Filtros
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onResetFiltros}
              title="Restaurar padrões"
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors text-xs flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onCloseMobile}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 lg:hidden"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status de linhas */}
        <div className="px-4 py-2 bg-slate-900/40 border-b border-slate-800/80 text-[11px] text-slate-400 flex justify-between items-center">
          <span>Linhas no filtro:</span>
          <span className="font-bold text-orange-400">
            {linhasFiltradas.toLocaleString("pt-BR")} / {totalLinhasValidas.toLocaleString("pt-BR")}
          </span>
        </div>

        {/* Conteúdo com scroll */}
        <div className="flex-1 overflow-y-auto lg:overflow-visible p-4 space-y-5 text-xs">
          {/* Seção Base de Dados */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
              Base de Dados
            </label>
            <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-2.5 space-y-2">
              <div className="text-[11px] text-slate-300 truncate">
                Fonte: <span className="text-amber-400 font-medium">{nomeArquivoBase}</span>
              </div>
              {isAdmin ? <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onUploadArquivo(file);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded bg-orange-600 hover:bg-orange-500 text-white font-medium text-xs transition-colors shadow-sm"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Substituir Planilha</span>
                </button>
                <p className="text-[10px] text-slate-400 text-center">
                  Formatos aceitos: CSV (delimitador vírgula ou ponto-e-vírgula) e Excel (.xlsx).
                </p>
              </> : <div className="rounded border border-slate-700 bg-slate-950/60 px-2.5 py-2 text-[10px] leading-4 text-slate-400"><strong className="text-slate-300">Modo consulta.</strong> O envio e a substituição de arquivos estão disponíveis somente para a conta administradora.</div>}
            </div>
          </div>

          <hr className="border-slate-800" />

          {/* Período de emissão */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
              Período de Emissão
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-slate-400 block mb-0.5">Início:</span>
                <input
                  type="date"
                  value={filtros.dataInicio}
                  onChange={(e) => setFiltros((prev) => ({ ...prev, dataInicio: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-orange-500"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block mb-0.5">Fim:</span>
                <input
                  type="date"
                  value={filtros.dataFim}
                  onChange={(e) => setFiltros((prev) => ({ ...prev, dataFim: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-orange-500"
                />
              </div>
            </div>
          </div>

          <hr className="border-slate-800" />

          {/* Tipo de produto */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">Tipo de Produto</label>
            <p className="text-[10px] text-slate-500">Classificação automática por descrição, categoria e forma de venda.</p>
            {renderMultiSelect("Tipo de produto", "tiposProduto", opcoesFiltros.tiposProduto)}
          </div>

          <hr className="border-slate-800" />

          {/* Forma de venda */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                Forma de Venda
              </label>
            </div>

            <label className="flex items-center gap-2 p-1.5 rounded bg-slate-900/60 hover:bg-slate-900 border border-slate-800 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={filtros.considerarTodasFormas}
                onChange={(e) =>
                  setFiltros((prev) => ({ ...prev, considerarTodasFormas: e.target.checked }))
                }
                className="rounded text-orange-500 focus:ring-orange-500"
              />
              <span className="text-[11px] font-medium text-amber-300">
                Considerar todas as formas de venda
              </span>
            </label>

            {!filtros.considerarTodasFormas && (
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400">
                  Tipos selecionados (padrão: V ProdPrópria p Consumo):
                </span>
                <div className="relative">
                  <input type="search" value={buscaDoFiltro("tiposVenda")} onChange={(e) => atualizarBuscaFiltro("tiposVenda", e.target.value)} placeholder="Buscar forma de venda..." className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded pl-7 pr-2 py-1 text-[11px] focus:ring-1 focus:ring-orange-500" />
                  <Search className="w-3 h-3 text-slate-500 absolute left-2 top-2" />
                </div>
                <div className="max-h-28 overflow-y-auto bg-slate-900 border border-slate-800 rounded p-1.5 space-y-1">
                  {opcoesFiltros.tiposVenda.filter((tipo) => !buscaDoFiltro("tiposVenda") || tipo.toLocaleLowerCase().includes(buscaDoFiltro("tiposVenda").toLocaleLowerCase())).map((tipo) => {
                    const isChecked = filtros.tiposVendaSelecionados.includes(tipo);
                    return (
                      <label
                        key={tipo}
                        className="flex items-center gap-1.5 p-1 rounded hover:bg-slate-800/80 cursor-pointer select-none text-[11px]"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleArrayItem("tiposVendaSelecionados", tipo)}
                          className="rounded text-orange-500 focus:ring-orange-500"
                        />
                        <span className="truncate text-slate-300">{tipo}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <hr className="border-slate-800" />

          {/* Exclusões da análise */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
              Exclusões da Análise
            </label>
            <p className="text-[10px] text-slate-400">
              Retirar famílias específicas de todas as abas (ex: acessórios ou códigos avulsos):
            </p>
            <div className="relative">
              <input type="search" value={buscaDoFiltro("familiasExcluidas")} onChange={(e) => atualizarBuscaFiltro("familiasExcluidas", e.target.value)} placeholder="Buscar família para excluir..." className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded pl-7 pr-2 py-1 text-[11px] focus:ring-1 focus:ring-orange-500" />
              <Search className="w-3 h-3 text-slate-500 absolute left-2 top-2" />
            </div>
            <div className="max-h-28 overflow-y-auto bg-slate-900 border border-slate-800 rounded p-1.5 space-y-1">
              {opcoesFiltros.familias.filter((fam) => !buscaDoFiltro("familiasExcluidas") || fam.toLocaleLowerCase().includes(buscaDoFiltro("familiasExcluidas").toLocaleLowerCase())).map((fam) => {
                const isExcluded = filtros.familiasExcluidas.includes(fam);
                return (
                  <label
                    key={fam}
                    className="flex items-center gap-1.5 p-1 rounded hover:bg-slate-800/80 cursor-pointer select-none text-[11px]"
                  >
                    <input
                      type="checkbox"
                      checked={isExcluded}
                      onChange={() => toggleArrayItem("familiasExcluidas", fam)}
                      className="rounded text-red-500 focus:ring-red-500"
                    />
                    <span className={isExcluded ? "text-red-400 line-through truncate" : "text-slate-300 truncate"}>
                      {fam}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <hr className="border-slate-800" />

          {/* Busca textual de produtos */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
              Buscar Produto / Carreta
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Ex: CBHM, CTH, TANQUE..."
                value={filtros.buscaProduto}
                onChange={(e) => setFiltros((prev) => ({ ...prev, buscaProduto: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded pl-7 pr-2 py-1.5 text-xs focus:ring-1 focus:ring-orange-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-2.5" />
            </div>
          </div>

          <hr className="border-slate-800" />

          {/* Filtros multidimensionais com multiselect */}
          <div className="space-y-4">
            {renderMultiSelect("Ano", "anos", opcoesFiltros.anos)}
            {renderMultiSelect("Região", "regioes", opcoesFiltros.regioes)}
            {renderMultiSelect("UF (Estado)", "ufs", opcoesFiltros.ufs)}
            {renderMultiSelect("Cidade", "cidades", opcoesFiltros.cidades)}
            {renderMultiSelect("Representante", "representantes", opcoesFiltros.representantes)}
            {renderMultiSelect("Lista de Preço UF", "listasPreco", opcoesFiltros.listasPreco)}
            {renderMultiSelect("Cliente", "clientes", opcoesFiltros.clientes)}
            {renderMultiSelect("Cliente Base", "clientesBase", opcoesFiltros.clientesBase)}
            {renderMultiSelect("Categoria do Produto", "categorias", opcoesFiltros.categorias)}
            {renderMultiSelect("Descrição Genérica", "descricoesGenericas", opcoesFiltros.descricoes)}
            {renderMultiSelect("Grupo / Modelo", "gruposModelo", opcoesFiltros.gruposModelo)}
            {renderMultiSelect("Família", "familias", opcoesFiltros.familias)}
          </div>

          <div className="pt-2 pb-6 text-center text-[10px] text-slate-500">
            Multiselect vazio = todos os itens considerados.
          </div>
        </div>
      </aside>
    </>
  );
};
