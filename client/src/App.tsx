import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Login from "./pages/Login";


function Router({ onLogout }: { onLogout: () => void }) {
  return (
    <Switch>
      <Route path={"/"} component={() => <Home onLogout={onLogout} />} />
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
    return window.localStorage.getItem("cemag_login_autenticado") === "true"
      ? window.localStorage.getItem("cemag_login_email")
      : null;
  });

  const sair = () => {
    localStorage.removeItem("cemag_login_autenticado");
    localStorage.removeItem("cemag_login_email");
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
          {emailAutenticado ? <Router onLogout={sair} /> : <Login onAuthenticated={setEmailAutenticado} />}
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
