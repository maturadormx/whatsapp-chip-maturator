import { Card } from "@/components/ui/card";
import { Activity, FileText, Home, Library, Megaphone, QrCode, ScrollText, Settings2, ShieldCheck, Users, Workflow } from "lucide-react";
import { useLocation } from "wouter";

type SystemType = "maturation" | "marketing";

const sidebarConfig: Record<
  SystemType,
  {
    title: string;
    subtitle: string;
    accent: string;
    items: Array<{ path: string; label: string; icon: any }>;
  }
> = {
  maturation: {
    title: "Sistema 1",
    subtitle: "Maturação",
    accent: "emerald",
    items: [
      { path: "/admin-systems", label: "Central admin", icon: Home },
      { path: "/dashboard", label: "Visão geral", icon: Activity },
      { path: "/connect-chip", label: "Conectar chips", icon: QrCode },
      { path: "/profiles", label: "Perfis", icon: Users },
      { path: "/operations", label: "Operação", icon: Library },
      { path: "/logs", label: "Logs", icon: ScrollText },
      { path: "/reports", label: "Relatórios", icon: FileText },
    ],
  },
  marketing: {
    title: "Sistema 2",
    subtitle: "Marketing",
    accent: "fuchsia",
    items: [
      { path: "/admin-systems", label: "Central admin", icon: Home },
      { path: "/bulk-dispatch", label: "Campanhas", icon: Megaphone },
      { path: "/bulk-dispatch#fila", label: "Fila e agenda", icon: Workflow },
      { path: "/bulk-dispatch#analytics", label: "Análises", icon: ShieldCheck },
      { path: "/bulk-dispatch#blacklist", label: "Lista de bloqueio", icon: Settings2 },
      { path: "/reports", label: "Relatórios", icon: FileText },
    ],
  },
};

export default function SystemSidebar({ system }: { system: SystemType }) {
  const [location, setLocation] = useLocation();
  const config = sidebarConfig[system];
  const isMarketing = system === "marketing";

  const activeClasses = isMarketing
    ? "bg-fuchsia-500/12 text-fuchsia-300 border border-fuchsia-400/20"
    : "bg-emerald-500/12 text-emerald-300 border border-emerald-400/20";
  const idleClasses = isMarketing
    ? "text-slate-400 hover:text-fuchsia-200 hover:bg-fuchsia-500/5 border border-transparent"
    : "text-slate-400 hover:text-emerald-200 hover:bg-emerald-500/5 border border-transparent";

  return (
    <Card className={`card-premium-enhanced p-5 h-fit ${isMarketing ? "border-fuchsia-500/15" : "border-emerald-500/15"}`}>
      <p className={`text-xs uppercase tracking-[0.12em] ${isMarketing ? "text-fuchsia-300" : "text-emerald-300"} mb-2`}>
        {config.title}
      </p>
      <h3 className="text-lg font-semibold text-white mb-1">{config.subtitle}</h3>
      <p className="text-sm text-slate-400 mb-4">
        {isMarketing
          ? "Campanhas, fila, agenda e resultado comercial."
          : "Saúde, aquecimento, ritmo e estabilidade operacional."}
      </p>

      <div className="space-y-2">
        {config.items.map((item) => {
          const Icon = item.icon;
          const active = location === item.path || (item.path.includes("#") && location === item.path.split("#")[0]);
          return (
            <button
              key={item.path}
              onClick={() => setLocation(item.path.split("#")[0])}
              className={`w-full flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${active ? activeClasses : idleClasses}`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
