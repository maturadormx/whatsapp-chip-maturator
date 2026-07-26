import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, ArrowLeft, ArrowRight, Megaphone, MonitorPlay, ShieldCheck, Sparkles } from "lucide-react";
import { useLocation } from "wouter";

export default function SystemDemo() {
  const [, setLocation] = useLocation();

  return (
    <div className="app-shell bg-app-grid">
      <div className="page-container py-10">
        <p className="page-breadcrumb page-breadcrumb-cyan">Central admin / demo operacional</p>
        <div className="page-hero md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="page-title mb-2">DEMO DO ECOSSISTEMA</h1>
            <p className="page-subtitle">
              Visão de apresentação do produto com os dois sistemas independentes e seus papéis operacionais.
            </p>
          </div>
          <Button className="btn-primary-modern" onClick={() => setLocation("/admin-systems")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar à central
          </Button>
        </div>

        <Card className="demo-hero-panel mb-6">
          <div className="relative z-10">
            <div className="demo-badge mb-4">
              <Sparkles className="w-4 h-4 text-fuchsia-300" />
              Apresentação comercial refinada
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.75fr] gap-6">
              <div>
                <h2 className="text-3xl font-semibold text-white tracking-tight mb-3">
                  W.M.S.E entrega controle operacional e execução comercial sem misturar contextos
                </h2>
                <p className="text-slate-300 leading-7 mb-6">
                  A demonstração mostra uma arquitetura simples de explicar: primeiro você prepara a base com maturação, depois escala campanhas com marketing.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button className="btn-primary-modern" onClick={() => setLocation("/dashboard")}>
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Abrir sistema 1
                  </Button>
                  <Button className="bg-fuchsia-500 hover:bg-fuchsia-600 text-black font-semibold" onClick={() => setLocation("/bulk-dispatch")}>
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Abrir sistema 2
                  </Button>
                </div>
              </div>
              <div className="demo-metric-grid w-full">
                <div className="demo-metric-card">
                  <p className="demo-metric-label">Narrativa</p>
                  <p className="demo-metric-value">2 sistemas</p>
                </div>
                <div className="demo-metric-card">
                  <p className="demo-metric-label">Entrada</p>
                  <p className="demo-metric-value">1 central</p>
                </div>
                <div className="demo-metric-card">
                  <p className="demo-metric-label">Leitura</p>
                  <p className="demo-metric-value">Clara</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card className="card-premium-enhanced p-6 border-cyan-500/15">
            <div className="flex items-center gap-3 mb-4">
              <MonitorPlay className="w-6 h-6 text-cyan-300" />
              <p className="text-sm font-semibold text-white">Fluxo do produto</p>
            </div>
            <p className="text-sm text-slate-400 leading-7">
              O admin entra pela central, escolhe o sistema certo e opera sem misturar maturação com campanha.
            </p>
          </Card>

          <Card className="card-premium-enhanced p-6 border-emerald-500/15">
            <div className="flex items-center gap-3 mb-4">
              <Activity className="w-6 h-6 text-emerald-300" />
              <p className="text-sm font-semibold text-white">Sistema 1</p>
            </div>
            <p className="text-sm text-slate-400 leading-7">
              Maturação prepara a base: conecta chips, define perfis, acompanha saúde e evolui a prontidão operacional.
            </p>
          </Card>

          <Card className="card-premium-enhanced p-6 border-fuchsia-500/15">
            <div className="flex items-center gap-3 mb-4">
              <Megaphone className="w-6 h-6 text-fuchsia-300" />
              <p className="text-sm font-semibold text-white">Sistema 2</p>
            </div>
            <p className="text-sm text-slate-400 leading-7">
              Marketing opera campanhas, fila, lista de bloqueio, agenda, análises e resultado comercial com motor próprio.
            </p>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card className="card-premium-enhanced p-8 border-emerald-500/20 bg-gradient-to-br from-emerald-500/8 to-transparent">
            <div className="flex items-center gap-3 mb-4">
              <ShieldCheck className="w-6 h-6 text-emerald-300" />
              <h2 className="text-xl font-semibold text-white">Demonstração de Maturação</h2>
            </div>
            <div className="space-y-3 text-sm text-slate-300 mb-8">
              <p>1. Conectar chips e validar saúde.</p>
              <p>2. Aplicar perfis e regras operacionais.</p>
              <p>3. Acompanhar progresso, falhas e hotspots.</p>
            </div>
            <Button className="btn-primary-modern" onClick={() => setLocation("/dashboard")}>
              <ArrowRight className="w-4 h-4 mr-2" />
              Abrir demo da maturação
            </Button>
          </Card>

          <Card className="card-premium-enhanced p-8 border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-500/8 to-transparent">
            <div className="flex items-center gap-3 mb-4">
              <Sparkles className="w-6 h-6 text-fuchsia-300" />
              <h2 className="text-xl font-semibold text-white">Demonstração de Marketing</h2>
            </div>
            <div className="space-y-3 text-sm text-slate-300 mb-8">
              <p>1. Criar campanha, fila e agenda.</p>
              <p>2. Operar lista de bloqueio, tags e distribuição.</p>
              <p>3. Ler análises, risco, histórico e relatórios.</p>
            </div>
            <Button className="bg-fuchsia-500 hover:bg-fuchsia-600 text-black font-semibold" onClick={() => setLocation("/bulk-dispatch")}>
              <ArrowRight className="w-4 h-4 mr-2" />
              Abrir demo do marketing
            </Button>
          </Card>
        </div>

        <Card className="card-premium-enhanced p-6 mb-6 border-white/10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="demo-step">
              <div className="demo-step-index">1</div>
              <div>
                <p className="text-sm font-semibold text-white">Abra a central</p>
                <p className="text-sm text-slate-400 mt-1">Mostre a decisão entre base operacional e camada comercial.</p>
              </div>
            </div>
            <div className="demo-step">
              <div className="demo-step-index">2</div>
              <div>
                <p className="text-sm font-semibold text-white">Conte a história da base</p>
                <p className="text-sm text-slate-400 mt-1">Explique maturação como infraestrutura de estabilidade e prontidão.</p>
              </div>
            </div>
            <div className="demo-step">
              <div className="demo-step-index">3</div>
              <div>
                <p className="text-sm font-semibold text-white">Escalone com marketing</p>
                <p className="text-sm text-slate-400 mt-1">Feche a demonstração com fila, agenda, análises e relatórios.</p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="card-premium-enhanced p-6 border-cyan-500/15">
          <p className="text-sm font-semibold text-white mb-2">Mensagem de demo</p>
          <p className="text-sm text-slate-400">
            O produto não vende um fluxo único. Ele vende dois sistemas independentes com uma central única de entrada.
          </p>
        </Card>
      </div>
    </div>
  );
}
