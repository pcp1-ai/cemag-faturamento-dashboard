import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Login, { ADMIN_EMAIL } from "./pages/Login";

const INATIVIDADE_MAXIMA_MS = 48 * 60 * 60 * 1000;
const CHAVE_ULTIMA_ATIVIDADE = "cemag_login_ultima_atividade";

function Router({ onLogout, email }: { onLogout: () => void; email: string }) {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={() => <Home onLogout={onLogout} emailAutenticado={email} isAdmin={email.toLowerCase() === ADMIN_EMAIL} />} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  const [emailAutenticado, setEmailAutenticado] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const autenticado = window.localStorage.getItem("cemag_login_autenticado") === "true";
    const ultimaAtividade = Number(window.localStorage.getItem(CHAVE_ULTIMA_ATIVIDADE) || 0);
    const sessaoExpirada = !ultimaAtividade || Date.now() - ultimaAtividade >= INATIVIDADE_MAXIMA_MS;
    if (!autenticado || sessaoExpirada) {
      window.localStorage.removeItem("cemag_login_autenticado");
      window.localStorage.removeItem("cemag_login_email");
      window.localStorage.removeItem(CHAVE_ULTIMA_ATIVIDADE);
      return null;
    }
    return window.localStorage.getItem("cemag_login_email");
  });

  useEffect(() => {
    if (!emailAutenticado) return;
    let ultimaGravacao = Number(localStorage.getItem(CHAVE_ULTIMA_ATIVIDADE) || Date.now());
    const registrarAtividade = () => {
      const agora = Date.now();
      if (agora - ultimaGravacao >= 60_000) {
        localStorage.setItem(CHAVE_ULTIMA_ATIVIDADE, String(agora));
        ultimaGravacao = agora;
      }
    };
    const verificarExpiracao = () => {
      const ultimaAtividade = Number(localStorage.getItem(CHAVE_ULTIMA_ATIVIDADE) || 0);
      if (!ultimaAtividade || Date.now() - ultimaAtividade >= INATIVIDADE_MAXIMA_MS) {
        localStorage.removeItem("cemag_login_autenticado");
        localStorage.removeItem("cemag_login_email");
        localStorage.removeItem(CHAVE_ULTIMA_ATIVIDADE);
        setEmailAutenticado(null);
      }
    };
    const eventos = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    eventos.forEach((evento) => window.addEventListener(evento, registrarAtividade, { passive: true }));
    const intervalo = window.setInterval(verificarExpiracao, 60_000);
    return () => {
      eventos.forEach((evento) => window.removeEventListener(evento, registrarAtividade));
      window.clearInterval(intervalo);
    };
  }, [emailAutenticado]);

  const sair = () => {
    localStorage.removeItem("cemag_login_autenticado");
    localStorage.removeItem("cemag_login_email");
    localStorage.removeItem(CHAVE_ULTIMA_ATIVIDADE);
    setEmailAutenticado(null);
  };

  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          {emailAutenticado ? <Router onLogout={sair} email={emailAutenticado} /> : <Login onAuthenticated={setEmailAutenticado} />}
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
