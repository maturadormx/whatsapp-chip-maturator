import { useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isAdminRole } from "@/lib/access";
import {
  ArrowLeft,
  Check,
  Crown,
  Rocket,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useLocation } from "wouter";

type PlanCategory = "semProxy" | "comProxy";

interface PlanOption {
  id: string;
  name: string;
  chips: number;
  price: number;
  period: string;
  icon: typeof Rocket;
  accent: string;
  popular?: boolean;
  summary: string;
  features: string[];
}

const plans: Record<PlanCategory, PlanOption[]> = {
  semProxy: [
    {
      id: "starter",
      name: "Starter",
      chips: 10,
      price: 50,
      period: "30 dias",
      icon: Rocket,
      accent: "from-cyan-500 to-blue-500",
      summary: "Entrada rápida para quem quer aquecer operação com custo enxuto.",
      features: [
        "10 chips simultâneos",
        "IP compartilhado do servidor",
        "Maturação básica",
        "Acompanhamento em tempo real",
        "Suporte 24/7",
      ],
    },
    {
      id: "pro",
      name: "Pro",
      chips: 20,
      price: 80,
      period: "30 dias",
      icon: Crown,
      accent: "from-sky-500 to-indigo-500",
      popular: true,
      summary: "Ponto ideal para escalar volume com mais conforto operacional.",
      features: [
        "20 chips simultâneos",
        "IP compartilhado do servidor",
        "Maturação avançada",
        "Suporte prioritário",
        "Análises detalhadas",
        "Agendamento automático",
      ],
    },
    {
      id: "enterprise",
      name: "Enterprise",
      chips: 50,
      price: 140,
      period: "30 dias",
      icon: Sparkles,
      accent: "from-cyan-500 to-blue-600",
      summary: "Volume alto com estrutura forte para operação contínua.",
      features: [
        "50 chips simultâneos",
        "IP compartilhado do servidor",
        "Maturação completa",
        "Suporte VIP",
        "Relatórios personalizados",
        "API exclusiva",
      ],
    },
  ],
  comProxy: [
    {
      id: "starter-proxy",
      name: "Starter Proxy",
      chips: 5,
      price: 150,
      period: "30 dias",
      icon: Shield,
      accent: "from-emerald-500 to-lime-500",
      summary: "Proteção dedicada para operações menores com mais segurança por chip.",
      features: [
        "5 chips simultâneos",
        "IP exclusivo por chip",
        "Proteção máxima",
        "Acompanhamento em tempo real",
        "Suporte 24/7",
      ],
    },
    {
      id: "pro-proxy",
      name: "Pro Proxy",
      chips: 10,
      price: 280,
      period: "30 dias",
      icon: ShieldCheck,
      accent: "from-emerald-500 to-cyan-500",
      popular: true,
      summary: "Maior blindagem para volume sensível e uso com mais estabilidade.",
      features: [
        "10 chips simultâneos",
        "IP exclusivo por chip",
        "Proteção máxima",
        "Anti-bloqueio inteligente",
        "Suporte prioritário",
        "Análises avançadas",
      ],
    },
    {
      id: "enterprise-proxy",
      name: "Enterprise Proxy",
      chips: 20,
      price: 550,
      period: "30 dias",
      icon: Crown,
      accent: "from-amber-400 to-orange-500",
      summary: "Estrutura premium para operação pesada com máxima proteção.",
      features: [
        "20 chips simultâneos",
        "IP exclusivo por chip",
        "Proteção máxima",
        "Anti-bloqueio avançado",
        "Suporte VIP",
        "Gerente dedicado",
      ],
    },
  ],
};

const categoryMeta = {
  semProxy: {
    title: "Sem proxy",
    subtitle: "Melhor custo-benefício para começar e escalar com IP compartilhado.",
    pill: "Volume com custo menor",
  },
  comProxy: {
    title: "Com proxy",
    subtitle: "Mais blindagem por chip para operações sensíveis e proteção máxima.",
    pill: "Proteção premium",
  },
} as const;

export default function Plans() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [category, setCategory] = useState<PlanCategory>("semProxy");
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const filteredPlans = useMemo(() => plans[category], [category]);
  const activePlan = filteredPlans.find((plan) => plan.id === selectedPlan) ?? null;
  const backPath = isAuthenticated ? (isAdminRole(user?.role) ? "/admin-systems" : "/workspace") : "/login";

  return (
    <div className="app-shell bg-app-grid text-white font-poppins overflow-hidden">
      <div className="fixed inset-0 opacity-10 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(0deg, transparent 24%, rgba(0, 255, 255, 0.08) 25%, rgba(0, 255, 255, 0.08) 26%, transparent 27%, transparent 74%, rgba(0, 255, 255, 0.08) 75%, rgba(0, 255, 255, 0.08) 76%, transparent 77%, transparent),
                             linear-gradient(90deg, transparent 24%, rgba(59, 130, 246, 0.08) 25%, rgba(59, 130, 246, 0.08) 26%, transparent 27%, transparent 74%, rgba(59, 130, 246, 0.08) 75%, rgba(59, 130, 246, 0.08) 76%, transparent 77%, transparent)`,
            backgroundSize: "72px 72px",
          }}
        />
      </div>

      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-[-10%] w-[38rem] h-[38rem] bg-cyan-500/10 blur-[140px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[34rem] h-[34rem] bg-blue-500/10 blur-[140px] rounded-full" />
      </div>

      <div className="relative z-10 page-container py-10">
        <p className="page-breadcrumb page-breadcrumb-cyan">
          {isAuthenticated && isAdminRole(user?.role) ? "Central admin / planos" : "Área do usuário / planos"}
        </p>
        <div className="page-hero md:flex-row md:items-end md:justify-between">
          <div className="max-w-5xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-sm mb-6">
              <Star className="w-4 h-4" />
              Planos W.M.S.E com foco em escala, proteção e maturação contínua
            </div>
            <h1 className="page-title mb-4">
              Escolha o plano
              <span className="block bg-gradient-to-r from-cyan-400 via-white to-blue-400 bg-clip-text text-transparent">
                ideal para sua operação
              </span>
            </h1>
            <p className="page-subtitle leading-8">
              Compare capacidade, proteção e ritmo de crescimento dentro do ecossistema W.M.S.E. A ideia aqui é deixar a decisão clara
              em poucos segundos, sem visual cru nem tabela sem vida.
            </p>
          </div>
          <Button className="btn-primary-modern" onClick={() => setLocation(backPath)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {isAuthenticated && isAdminRole(user?.role) ? "Voltar à central admin" : "Voltar à área do usuário"}
          </Button>
        </div>

        <Card className="card-premium-enhanced p-6 mb-10 max-w-5xl mx-auto">
          <div className="status-banner status-banner-ok">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">Leitura rápida dos planos</p>
                <p className="text-sm text-gray-300 mt-1">
                  Use `sem proxy` para custo menor e escala inicial. Use `com proxy` quando a prioridade for blindagem e maior proteção por chip.
                </p>
              </div>
              <Button variant="outline" className="subtle-action">
                Falar com atendimento
              </Button>
            </div>

            <div className="summary-grid mt-4">
              <div className="summary-pill">
                <p className="summary-pill-label">Categoria atual</p>
                <p className="summary-pill-value">{categoryMeta[category].title}</p>
              </div>
              <div className="summary-pill">
                <p className="summary-pill-label">Planos visíveis</p>
                <p className="summary-pill-value">{filteredPlans.length}</p>
              </div>
              <div className="summary-pill">
                <p className="summary-pill-label">Plano selecionado</p>
                <p className="summary-pill-value">{activePlan?.name ?? "Nenhum"}</p>
              </div>
              <div className="summary-pill">
                <p className="summary-pill-label">Faixa de chips</p>
                <p className="summary-pill-value">
                  {Math.min(...filteredPlans.map((plan) => plan.chips))} a {Math.max(...filteredPlans.map((plan) => plan.chips))}
                </p>
              </div>
            </div>
          </div>
        </Card>

        <div className="max-w-4xl mx-auto mb-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-2 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
            {(["semProxy", "comProxy"] as const).map((item) => (
              <button
                key={item}
                onClick={() => {
                  setCategory(item);
                  setSelectedPlan(null);
                }}
                className={`rounded-xl px-5 py-5 text-left transition-all ${
                  category === item
                    ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-400/30 shadow-[0_0_30px_rgba(34,211,238,0.15)]"
                    : "border border-transparent hover:border-white/10 hover:bg-white/5"
                }`}
              >
                <div className="flex items-center justify-between gap-4 mb-2">
                  <div>
                    <p className="text-xl font-semibold text-white">{categoryMeta[item].title}</p>
                    <p className="text-sm text-gray-400">{categoryMeta[item].subtitle}</p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-black/40 border border-white/10 text-cyan-300">
                    {categoryMeta[item].pill}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {filteredPlans.map((plan) => {
            const Icon = plan.icon;
            const selected = selectedPlan === plan.id;

            return (
              <div
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={`relative rounded-3xl border p-6 cursor-pointer transition-all duration-300 overflow-hidden ${
                  selected
                    ? "border-cyan-400/60 bg-white/[0.08] shadow-[0_0_40px_rgba(34,211,238,0.18)] -translate-y-1"
                    : "border-white/10 bg-white/[0.04] hover:bg-white/[0.06] hover:border-cyan-400/20"
                }`}
              >
                <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${plan.accent}`} />

                {plan.popular && (
                  <div className="absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 border border-blue-400/40 text-blue-200">
                    Mais escolhido
                  </div>
                )}

                <div className="flex items-center gap-3 mb-6">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-r ${plan.accent} flex items-center justify-center shadow-lg`}>
                    <Icon className="w-6 h-6 text-black" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-white">{plan.name}</p>
                    <p className="text-sm text-gray-400">{plan.period}</p>
                  </div>
                </div>

                <div className="mb-5">
                  <div className="flex items-end gap-2 mb-2">
                    <span className="text-5xl font-orbitron font-bold text-white">{plan.chips}</span>
                    <span className="text-gray-400 pb-2">chips</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm text-gray-400">R$</span>
                    <span className="text-4xl font-bold text-cyan-300">{plan.price}</span>
                    <span className="text-sm text-gray-400">/ 30 dias</span>
                  </div>
                </div>

                <p className="text-sm text-gray-300 leading-7 min-h-[84px] mb-6">
                  {plan.summary}
                </p>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Capacidade</p>
                    <p className="text-white font-semibold flex items-center gap-2">
                      <Users className="w-4 h-4 text-cyan-400" />
                      {plan.chips} contas
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Perfil</p>
                    <p className="text-white font-semibold flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-blue-300" />
                      {plan.popular ? "Escala" : "Entrada"}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-3">
                      <div className="mt-0.5 w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center">
                        <Check className="w-3 h-3 text-emerald-400" />
                      </div>
                      <span className="text-sm text-gray-300 leading-6">{feature}</span>
                    </div>
                  ))}
                </div>

                <Button
                  className={`w-full rounded-xl py-6 font-semibold ${
                    selected
                      ? `bg-gradient-to-r ${plan.accent} text-black hover:opacity-95`
                      : "bg-black/30 text-white border border-white/10 hover:bg-white/10"
                  }`}
                  variant={selected ? "default" : "outline"}
                >
                  {selected ? "Plano selecionado" : "Selecionar plano"}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6 items-start">
          <div className="rounded-3xl border border-white/10 bg-white/[0.05] backdrop-blur-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <Zap className="w-5 h-5 text-cyan-400" />
              <h2 className="text-2xl font-bold text-white">O que todos os planos incluem</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                "Suporte 24/7",
                "Atualizações automáticas",
                "Acompanhamento em tempo real",
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-black/20 p-4 text-gray-300">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 p-6">
            <p className="text-sm uppercase tracking-[0.25em] text-cyan-300 mb-2">Resumo</p>
            <h3 className="text-2xl font-bold text-white mb-3">
              {activePlan ? activePlan.name : "Selecione um plano"}
            </h3>
            <p className="text-gray-300 leading-7 mb-6">
              {activePlan
                ? `${activePlan.chips} chips por ${activePlan.period}, com foco em ${category === "comProxy" ? "proteção máxima" : "escala com custo menor"}.`
                : "Escolha um plano para destacar os dados principais e seguir para a assinatura."}
            </p>
            <div className="flex flex-col gap-3">
              <Button
                disabled={!activePlan}
                className="w-full rounded-xl py-6 bg-gradient-to-r from-cyan-500 to-blue-500 text-black font-semibold hover:opacity-95"
              >
                Continuar com este plano
              </Button>
              <Button
                variant="outline"
                className="w-full rounded-xl py-6 border-white/10 text-white hover:bg-white/10"
              >
                Falar com atendimento
              </Button>
            </div>

            <div className="surface-item-compact mt-5">
              <p className="text-xs text-gray-400 uppercase tracking-[0.08em] mb-1">Sequência recomendada</p>
              <p className="text-sm text-gray-300">
                1. Escolha a categoria. 2. Compare chips e proteção. 3. Selecione um plano. 4. Continue ou fale com atendimento.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
