import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getDefaultRouteForRole } from "@/lib/access";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ShieldCheck, Sparkles, UserRound, Zap } from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";

export default function Login() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [localName, setLocalName] = useState("");
  const utils = trpc.useUtils();
  const {
    data: localStatus,
    isLoading: isLocalStatusLoading,
    isFetching: isLocalStatusFetching,
    isError: isLocalStatusError,
  } = trpc.auth.localStatus.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const localLoginMutation = trpc.auth.localLogin.useMutation();
  const isPreviewMode =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("preview") === "1";
  const localAuthEnabled = localStatus?.enabled === true;
  const isResolvingLocalStatus = !isPreviewMode && (isLocalStatusLoading || isLocalStatusFetching);

  useEffect(() => {
    if (isAuthenticated && !isPreviewMode) {
      setLocation(getDefaultRouteForRole(user?.role));
    }
  }, [isAuthenticated, isPreviewMode, setLocation, user?.role]);

  const handleLocalLogin = async (silent = false) => {
    try {
      setLoginError(null);
      await localLoginMutation.mutateAsync({
        name: authMode === "register" ? localName.trim() || undefined : undefined,
      });
      await utils.auth.me.invalidate();
      if (!silent) {
        sonnerToast.success(authMode === "register" ? "Acesso local criado com sucesso." : "Login local realizado com sucesso.");
      }
      setLocation("/");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Falha ao entrar localmente.";
      setLoginError(message);
      sonnerToast.error(message);
    }
  };

  if (isResolvingLocalStatus || (localAuthEnabled && (loading || localLoginMutation.isPending))) {
    return (
      <div className="min-h-screen bg-black text-white overflow-hidden font-poppins flex items-center justify-center px-4">
        <div className="w-full max-w-xl rounded-3xl border border-cyan-500/20 bg-white/[0.05] backdrop-blur-xl p-10 text-center shadow-[0_0_60px_rgba(15,23,42,0.45)]">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-500/40 bg-gradient-to-br from-cyan-500/20 to-blue-500/20">
            <Zap className="text-cyan-400" size={30} />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">
            {isResolvingLocalStatus ? "Verificando acesso" : "Entrando no modo local"}
          </h1>
          <p className="text-gray-300 leading-7">
            {isResolvingLocalStatus
              ? "Estamos validando a forma correta de autenticação para este ambiente. Essa tela deve aparecer só por alguns instantes."
              : "Preparando sua sessão local e carregando sua área de acesso. Essa tela deve aparecer só por alguns instantes."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden font-poppins">
      <div className="fixed inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(0deg, transparent 24%, rgba(0, 255, 255, 0.05) 25%, rgba(0, 255, 255, 0.05) 26%, transparent 27%, transparent 74%, rgba(0, 255, 255, 0.05) 75%, rgba(0, 255, 255, 0.05) 76%, transparent 77%, transparent),
                            linear-gradient(90deg, transparent 24%, rgba(0, 255, 255, 0.05) 25%, rgba(0, 255, 255, 0.05) 26%, transparent 27%, transparent 74%, rgba(0, 255, 255, 0.05) 75%, rgba(0, 255, 255, 0.05) 76%, transparent 77%, transparent)`,
          backgroundSize: "50px 50px",
        }} />
      </div>

      <div className="fixed top-20 right-20 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
      <div className="fixed bottom-20 left-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-white/[0.05] backdrop-blur-xl p-8 md:p-10 shadow-[0_0_60px_rgba(15,23,42,0.45)]">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-sm mb-6">
              <Sparkles className="w-4 h-4" />
              M13 Group • acesso ao ecossistema W.M.S.E
            </div>

            <div className="flex items-center justify-center gap-3 mb-5">
              <div className="p-3 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-2xl border border-cyan-500/40">
                <Zap className="text-cyan-400" size={30} />
              </div>
            </div>

            <p className="text-white font-bold text-3xl tracking-tight">W.M.S.E</p>
            <p className="text-gray-400 text-sm mt-2">Whats-Maturação e Sistema de Envio</p>

            <h1 className="text-4xl md:text-5xl font-black mt-6 mb-4 leading-tight">
              <span className="block text-white">Entre no sistema</span>
              <span className="block bg-gradient-to-r from-cyan-300 via-sky-300 to-blue-400 bg-clip-text text-transparent">
                com o perfil correto
              </span>
            </h1>
            <p className="text-gray-300 text-sm md:text-base leading-7 max-w-2xl mx-auto">
              O acesso agora está separado. Usuário simples entra na própria área de conta e assinatura. Administrador acessa operação, monitoramento e controle do sistema.
            </p>
            {isPreviewMode ? (
              <p className="text-cyan-300 text-xs mt-3">Modo preview ativo: esta tela está visível mesmo com sessão autenticada.</p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/8 p-5 text-left">
              <div className="flex items-start gap-3">
                <UserRound className="w-5 h-5 text-cyan-300 mt-0.5" />
                <div>
                  <p className="font-semibold text-white">Usuário simples</p>
                  <p className="text-sm text-slate-300 mt-1">Acessa perfil, assinatura, planos e a área própria do usuário.</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/8 p-5 text-left">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-amber-300 mt-0.5" />
                <div>
                  <p className="font-semibold text-white">Administrador</p>
                  <p className="text-sm text-slate-300 mt-1">Acessa painel operacional, monitoramento, chips, relatórios e admin do sistema.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/8 bg-black/25 p-6 md:p-8">
            <div className="text-center mb-8">
              <div className="inline-flex rounded-2xl border border-white/10 bg-black/30 p-1 mb-5">
                <button
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition ${authMode === "login" ? "bg-cyan-500 text-black" : "text-slate-300"}`}
                  onClick={() => setAuthMode("login")}
                >
                  Login
                </button>
                <button
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition ${authMode === "register" ? "bg-cyan-500 text-black" : "text-slate-300"}`}
                  onClick={() => setAuthMode("register")}
                >
                  Cadastro
                </button>
              </div>
              <h2 className="text-3xl font-bold text-white mb-3">{authMode === "register" ? "Criar acesso" : "Entrar"}</h2>
              <p className="text-gray-400 text-sm">
                {authMode === "register"
                  ? "Crie seu acesso inicial para entrar na área correta do sistema."
                  : "Autentique-se para entrar na sua área dentro do ecossistema W.M.S.E."}
              </p>
            </div>

            {localAuthEnabled && authMode === "register" && (
              <div className="mb-5 space-y-2">
                <label className="text-sm text-slate-300">Nome de acesso</label>
                <Input
                  value={localName}
                  onChange={(e) => setLocalName(e.target.value)}
                  placeholder="Ex: Comercial Norte"
                  className="field-control"
                />
                <p className="text-xs text-slate-500">
                  No ambiente local, o cadastro cria uma sessão local com o nome informado.
                </p>
              </div>
            )}

            {localAuthEnabled && (
              <Button
                onClick={() => handleLocalLogin()}
                disabled={localLoginMutation.isPending || (authMode === "register" && localName.trim().length < 2)}
                variant="outline"
                className="w-full py-6 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 rounded-2xl font-semibold mb-6"
              >
                {localLoginMutation.isPending
                  ? authMode === "register" ? "Criando acesso local..." : "Entrando localmente..."
                  : authMode === "register"
                    ? "Criar acesso local"
                    : `Entrar localmente${localStatus.name ? ` como ${localStatus.name}` : ""}`}
              </Button>
            )}

            {isLocalStatusError && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 mb-4">
                <p className="text-center text-red-300 text-sm">
                  Não foi possível validar o modo de acesso deste ambiente. Recarregue a página e tente novamente.
                </p>
              </div>
            )}

            {!isLocalStatusError && !localAuthEnabled && (
              <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4 mb-4">
                <p className="text-center text-yellow-300 text-sm">
                  O login local não está habilitado neste ambiente. Ative `LOCAL_AUTH_ENABLED=true` no Railway.
                </p>
              </div>
            )}

            {loginError && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 mb-4">
                <p className="text-center text-red-300 text-sm">{loginError}</p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: "Setup rápido", value: "1 login" },
                { label: "Visibilidade", value: "Tempo real" },
                { label: "Escala", value: "Multi chip" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-black/30 border border-white/10 p-3 text-center">
                  <p className="text-xs text-gray-500 uppercase mb-1">{item.label}</p>
                  <p className="text-sm font-semibold text-cyan-300">{item.value}</p>
                </div>
              ))}
            </div>

            <p className="text-center text-gray-500 text-xs">
              Ao entrar, você concorda com nossos Termos de Serviço e Política de Privacidade.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
