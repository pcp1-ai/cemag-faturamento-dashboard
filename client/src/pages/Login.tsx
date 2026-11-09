import React, { FormEvent, useEffect, useState } from "react";
import { LockKeyhole, Mail, ShieldCheck, Eye, EyeOff, AlertCircle } from "lucide-react";
import { trpc } from "../lib/trpc";

const EMAIL_CEMAG_REGEX = /^[^\s@]+@(cemag|itaueira)\.com\.br$/i;
const SENHA_PADRAO = "000000";
const ADMIN_EMAIL = "pcp1@cemag.com.br";

interface LoginProps {
  onAuthenticated: (email: string) => void;
  mensagemInicial?: string;
}

export default function Login({ onAuthenticated, mensagemInicial = "" }: LoginProps) {
  const loginMutation = trpc.auth.login.useMutation();
  const periodoQuery = trpc.auth.basePeriod.useQuery(undefined, { retry: false, staleTime: 10 * 60 * 1000 });
  const [periodoHistorico, setPeriodoHistorico] = useState(() => {
    if (typeof window === "undefined") return "Histórico disponível";
    try {
      const salvo = window.localStorage.getItem("cemag_base_periodo");
      if (!salvo) return "Histórico disponível";
      const periodo = JSON.parse(salvo) as { anoInicio?: number; anoFim?: number };
      if (!periodo.anoInicio || !periodo.anoFim) return "Histórico disponível";
      return periodo.anoInicio === periodo.anoFim ? String(periodo.anoInicio) : `${periodo.anoInicio}–${periodo.anoFim}`;
    } catch {
      return "Histórico disponível";
    }
  });
  useEffect(() => {
    const periodo = periodoQuery.data;
    if (!periodo?.anoInicio || !periodo.anoFim) return;
    const texto = periodo.anoInicio === periodo.anoFim ? String(periodo.anoInicio) : `${periodo.anoInicio}–${periodo.anoFim}`;
    setPeriodoHistorico(texto);
    try {
      localStorage.setItem("cemag_base_periodo", JSON.stringify(periodo));
    } catch {
      // O cartão continua exibindo o valor recebido do servidor.
    }
  }, [periodoQuery.data]);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState(mensagemInicial);
  const [enviando, setEnviando] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErro("");
    const emailNormalizado = email.trim().toLowerCase();

    if (!EMAIL_CEMAG_REGEX.test(emailNormalizado)) {
      setErro("Use um e-mail corporativo terminado em @cemag.com.br ou @itaueira.com.br.");
      return;
    }
    if (senha !== SENHA_PADRAO) {
      setErro("Senha inválida. Verifique a senha informada e tente novamente.");
      return;
    }

    setEnviando(true);
    try {
      const result = await loginMutation.mutateAsync({ email: emailNormalizado, password: senha });
      if (!result.success) {
        setErro(result.message);
        return;
      }
      localStorage.setItem("cemag_login_email", emailNormalizado);
      localStorage.setItem("cemag_login_autenticado", "true");
      localStorage.setItem("cemag_login_ultima_atividade", String(Date.now()));
      onAuthenticated(emailNormalizado);
    } catch {
      setErro("Não foi possível conectar ao servidor de autenticação. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f4f4f2] px-4 py-8 text-[#222222] sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[2rem] border border-[#e4e4e1] bg-white shadow-[0_24px_80px_rgba(34,34,34,0.12)] lg:grid-cols-[1.05fr_0.95fr]">
          <section className="relative hidden min-h-[620px] overflow-hidden bg-[linear-gradient(135deg,#FF4E09_0%,#f54a07_52%,#c23701_100%)] p-10 lg:flex lg:flex-col lg:justify-between">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/15 blur-3xl" />
            <div className="absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-[#8f2500]/30 blur-3xl" />
            <div className="relative">
              <div className="mb-8 flex items-center gap-3">
                <div className="rounded-xl bg-white p-3 shadow-lg"><img src="/manus-storage/cemag-logo-orange_4de005c2.png" alt="CEMAG" className="h-9 w-auto object-contain" /></div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-white">Inteligência Comercial</h1>
                  <p className="text-sm text-orange-100">CEMAG Carretas Agrícolas</p>
                </div>
              </div>
              <p className="max-w-md text-3xl font-semibold leading-tight text-white">Informação comercial para decisões mais rápidas e seguras.</p>
              <p className="mt-5 max-w-md text-sm leading-6 text-orange-100">Acompanhe faturamento, metas, produtos, clientes, regiões e previsões em um único painel.</p>
            </div>
            <div className="relative grid grid-cols-2 gap-3 text-xs text-orange-50">
              <div className="rounded-2xl border border-white/25 bg-white/10 p-4 backdrop-blur-sm"><strong className="block text-lg text-white">{periodoHistorico}</strong><span>Histórico disponível</span></div>
              <div className="rounded-2xl border border-white/25 bg-white/10 p-4 backdrop-blur-sm"><strong className="block text-lg text-white">CEMAG</strong><span>Acesso corporativo</span></div>
            </div>
          </section>

          <section className="flex min-h-[620px] flex-col justify-center p-6 sm:p-10">
            <div className="mx-auto w-full max-w-md">
              <div className="mb-8 lg:hidden">
                <div className="mb-4 flex items-center gap-3"><div className="rounded-xl border border-[#ececea] bg-white p-2"><img src="/manus-storage/cemag-logo-orange_4de005c2.png" alt="CEMAG" className="h-8 w-auto" /></div><div><h1 className="text-xl font-bold text-[#222222]">Inteligência Comercial</h1><p className="text-xs text-[#FF4E09]">CEMAG Carretas Agrícolas</p></div></div>
              </div>
              <div className="mb-8">
                <div className="mb-4 inline-flex rounded-2xl border border-[#FF4E09]/20 bg-[#FF4E09]/10 p-3 text-[#FF4E09]"><ShieldCheck className="h-6 w-6" /></div>
                <h2 className="text-2xl font-bold text-[#222222]">Acesso corporativo</h2>
                <p className="mt-2 text-sm leading-6 text-[#666666]">Entre com seu e-mail CEMAG para acessar o painel de inteligência comercial.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <label className="block text-sm font-medium text-[#333333]">E-mail corporativo
                  <span className="relative mt-2 block"><Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#888888]" /><input autoFocus type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="seu.nome@cemag.com.br ou @itaueira.com.br" autoComplete="email" className="w-full rounded-xl border border-[#d9d9d6] bg-[#fafaf8] py-3 pl-10 pr-3 text-sm text-[#222222] outline-none transition focus:border-[#FF4E09] focus:ring-2 focus:ring-[#FF4E09]/20" /></span>
                </label>
                <label className="block text-sm font-medium text-[#333333]">Senha
                  <span className="relative mt-2 block"><LockKeyhole className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#888888]" /><input type={mostrarSenha ? "text" : "password"} value={senha} onChange={(event) => setSenha(event.target.value)} placeholder="Digite sua senha" autoComplete="current-password" className="w-full rounded-xl border border-[#d9d9d6] bg-[#fafaf8] py-3 pl-10 pr-11 text-sm text-[#222222] outline-none transition focus:border-[#FF4E09] focus:ring-2 focus:ring-[#FF4E09]/20" /><button type="button" onClick={() => setMostrarSenha((value) => !value)} className="absolute right-3 top-2.5 rounded p-1 text-[#888888] hover:text-[#333333]" aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}>{mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span>
                </label>
                {erro && <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-800/70 bg-red-950/30 px-3 py-3 text-xs leading-5 text-red-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" /><span>{erro}</span></div>}
                <button type="submit" disabled={enviando} className="w-full rounded-xl bg-[#FF4E09] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#FF4E09]/20 transition hover:bg-[#f54a07] disabled:cursor-wait disabled:opacity-70">{enviando ? "Entrando..." : "Entrar no painel"}</button>
              </form>

              <div className="mt-6 rounded-xl border border-[#ececea] bg-[#fafaf8] px-4 py-3 text-xs leading-5 text-[#777777]"><strong className="text-[#333333]">Acesso inicial:</strong> utilize a senha padrão fornecida pela administração e um e-mail terminado em <span className="text-[#FF4E09]">@cemag.com.br</span> ou <span className="text-[#FF4E09]">@itaueira.com.br</span>. A sessão expira após 48 horas sem atividade.</div>
              <p className="mt-8 text-center text-[11px] text-[#999999]">Acesso restrito à equipe CEMAG</p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

export { ADMIN_EMAIL, EMAIL_CEMAG_REGEX, SENHA_PADRAO };
