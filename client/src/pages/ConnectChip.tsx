import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import SystemSidebar from "@/components/SystemSidebar";
import { useLocation } from "wouter";
import { QrCode, Check, AlertCircle, Loader2 } from "lucide-react";

export default function ConnectChip() {
  const { isAuthenticated, loading } = useAuth({
    redirectOnUnauthenticated: false,
  });
  const [chipName, setChipName] = useState("");
  const [chipId, setChipId] = useState<number | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const connectMutation = trpc.whatsapp.createAndConnectChip.useMutation();
  const qrQuery = trpc.whatsapp.getQRCode.useQuery(
    { chipId: chipId || 0 },
    {
      enabled: !!chipId && !isConnected,
      refetchInterval: isConnected ? false : 2000,
    }
  );

  const connectionError = useMemo(
    () => connectMutation.error?.message || qrQuery.error?.message || null,
    [connectMutation.error?.message, qrQuery.error?.message]
  );

  const handleConnect = async () => {
    if (!chipName.trim()) {
      return;
    }

    if (!isAuthenticated) {
      setLocation("/login");
      return;
    }

    setIsConnecting(true);
    setIsConnected(false);
    setQrCode(null);

    try {
      const result = await connectMutation.mutateAsync({
        chipName: chipName.trim(),
      });
      setChipId(result.chipId);
    } catch (error: any) {
      if (
        error?.message?.includes("Please login") ||
        error?.message?.includes("10001") ||
        error?.data?.code === "UNAUTHORIZED"
      ) {
        setLocation("/login");
      }
      console.error("Erro ao conectar:", error);
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    if (qrQuery.data?.qrCode) {
      setQrCode(qrQuery.data.qrCode);
    }
    if (qrQuery.data?.isConnected) {
      setIsConnected(true);
      setIsConnecting(false);
      void utils.chips.list.invalidate();
    }
  }, [qrQuery.data, utils.chips.list]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="card-premium-enhanced p-8 text-center">
          <p className="text-cyan-400 font-semibold">Carregando conexão...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell bg-app-grid text-white font-poppins overflow-hidden">
      <div className="fixed inset-0 opacity-10 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(0deg, transparent 24%, rgba(0, 255, 255, 0.06) 25%, rgba(0, 255, 255, 0.06) 26%, transparent 27%, transparent 74%, rgba(0, 255, 255, 0.06) 75%, rgba(0, 255, 255, 0.06) 76%, transparent 77%, transparent),
                             linear-gradient(90deg, transparent 24%, rgba(59, 130, 246, 0.06) 25%, rgba(59, 130, 246, 0.06) 26%, transparent 27%, transparent 74%, rgba(59, 130, 246, 0.06) 75%, rgba(59, 130, 246, 0.06) 76%, transparent 77%, transparent)`,
            backgroundSize: "72px 72px",
          }}
        />
      </div>

      <div className="page-container">
        <div className="system-layout">
          <SystemSidebar system="maturation" />
          <div className="system-main">
        <p className="page-breadcrumb page-breadcrumb-emerald">Central admin / sistema 1 / conectar chip</p>
        <div className="page-hero">
          <div>
            <h1 className="page-title mb-2">CONECTAR CHIP</h1>
            <p className="page-subtitle">
              Escaneie o QR Code do WhatsApp para autenticar o chip e trazer a sessão para o ambiente de maturação.
            </p>
          </div>
        </div>

        <div className={`status-banner mb-8 relative z-10 ${isConnected ? "status-banner-ok" : "status-banner-warn"}`}>
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">
                {isConnected ? "Chip conectado com sucesso" : isConnecting ? "Conexão em andamento" : "Pronto para iniciar conexão"}
              </p>
              <p className="text-sm text-gray-300 mt-1">
                {!isAuthenticated
                  ? "Faça login antes de iniciar. Depois disso, dê um nome ao chip, gere o QR Code e escaneie no WhatsApp."
                  : isConnected
                    ? "A sessão já foi criada e o chip está pronto para voltar ao dashboard."
                    : "Dê um nome ao chip, gere o QR Code e escaneie no WhatsApp em aparelhos conectados."}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="subtle-action" onClick={() => setLocation("/dashboard")}>
                Voltar à maturação
              </Button>
            </div>
          </div>

          <div className="summary-grid mt-4">
            <div className="summary-pill">
              <p className="summary-pill-label">Login</p>
              <p className="summary-pill-value">{isAuthenticated ? "ok" : "pendente"}</p>
            </div>
            <div className="summary-pill">
              <p className="summary-pill-label">Nome do chip</p>
              <p className="summary-pill-value">{chipName.trim() ? "ok" : "pendente"}</p>
            </div>
            <div className="summary-pill">
              <p className="summary-pill-label">QR Code</p>
              <p className="summary-pill-value">{qrCode ? "pronto" : isConnecting ? "gerando" : "aguardando"}</p>
            </div>
            <div className="summary-pill">
              <p className="summary-pill-label">Sessão</p>
              <p className="summary-pill-value">{chipId ? `#${chipId}` : "nova"}</p>
            </div>
          </div>
        </div>

        {!isConnected ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <div className="card-premium-enhanced space-y-6 relative z-10">
              <div>
                <label className="block text-sm font-bold mb-2 text-muted-foreground">
                  NOME DO CHIP
                </label>
                <Input
                  className="field-control"
                  placeholder="Ex: Chip Principal"
                  value={chipName}
                  onChange={(e) => setChipName(e.target.value)}
                  disabled={isConnecting}
                />
              </div>

              <Button
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-black font-bold"
                onClick={handleConnect}
                disabled={isConnecting || !chipName.trim()}
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    INICIANDO CONEXÃO...
                  </>
                ) : (
                  <>
                    <QrCode className="w-4 h-4 mr-2" />
                    INICIAR CONEXÃO
                  </>
                )}
              </Button>

              {!chipName.trim() && (
                <p className="text-xs text-muted-foreground">
                  Dê um nome ao chip para gerar a sessão e vincular o QR Code corretamente.
                </p>
              )}

              {!isAuthenticated && (
                <div className="p-4 border border-yellow-500/40 rounded-none bg-yellow-500/5">
                  <p className="text-yellow-400 text-sm">
                    Faça login antes de iniciar a conexão do chip.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-3 w-full border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10"
                    onClick={() => setLocation("/login")}
                  >
                    Ir para login
                  </Button>
                </div>
              )}

              {chipId && (
                <div className="surface-item-compact text-xs text-cyan-400/80">
                  SESSÃO ATIVA: CHIP #{chipId}
                </div>
              )}

              {connectionError && (
                <div className="surface-item-compact border border-destructive/40 bg-background/50">
                  <p className="text-destructive text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {connectionError}
                  </p>
                </div>
              )}

              <div className="surface-item-compact">
                <p className="text-xs text-gray-400 uppercase tracking-[0.08em] mb-1">Sequência recomendada</p>
                <p className="text-sm text-gray-300">
                  1. Nomeie o chip. 2. Gere o QR Code. 3. Escaneie no celular. 4. Volte ao dashboard para acompanhar o status.
                </p>
              </div>
            </div>

            {(isConnecting || qrCode) && (
              <div className="card-premium-enhanced flex flex-col items-center justify-center min-h-[320px] relative z-10">
                <div className="mb-4 w-full">
                  <p className="text-sm text-muted-foreground text-center mb-4">
                    ESCANEIE COM WHATSAPP
                  </p>
                  <div className="bg-white p-4 rounded-2xl border border-cyan-500/30 mx-auto w-fit">
                    {qrCode ? (
                      <img
                        src={qrCode}
                        alt="QR Code do WhatsApp"
                        className="w-56 h-56 object-contain"
                      />
                    ) : (
                      <div className="w-56 h-56 flex flex-col items-center justify-center text-center text-xs text-gray-500 gap-3">
                        <Loader2 className="w-6 h-6 animate-spin text-black" />
                        GERANDO QR CODE...
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center max-w-xs">
                  {qrCode
                    ? "Abra o WhatsApp no celular, vá em aparelhos conectados e escaneie o código."
                    : "A sessão foi criada. Aguarde alguns segundos até o WhatsApp gerar o QR Code."}
                </p>
                {!qrCode && (
                  <Button
                    variant="outline"
                    className="mt-4 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10"
                    onClick={() => qrQuery.refetch()}
                    disabled={!chipId}
                  >
                    Atualizar QR Code
                  </Button>
                )}
              </div>
            )}

            {!isConnecting && !qrCode && (
              <div className="card-premium-enhanced flex flex-col items-center justify-center min-h-[320px] text-center relative z-10">
                <QrCode className="w-12 h-12 text-cyan-400 mb-4" />
                <p className="text-sm text-muted-foreground max-w-xs">
                  Assim que a conexão for iniciada, o QR Code aparecerá aqui para escaneamento.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="card-premium-enhanced text-center py-12 relative z-10">
            <div className="mb-4 flex justify-center">
              <div className="w-16 h-16 rounded-full border-2 border-green-400 flex items-center justify-center">
                <Check className="w-8 h-8 text-green-400" />
              </div>
            </div>
            <h2 className="text-2xl font-orbitron font-bold neon-glow-cyan mb-2">
              CHIP CONECTADO!
            </h2>
            <p className="text-cyan-300 mb-6">
              {chipName} está pronto para maturação
            </p>
              <Button className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-black font-bold" onClick={() => setLocation("/")}>
                IR PARA DASHBOARD
              </Button>
          </div>
        )}
          </div>
        </div>
      </div>
    </div>
  );
}
