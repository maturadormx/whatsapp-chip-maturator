import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Save, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast as sonnerToast } from "sonner";
import { useLocation } from "wouter";

type ProfileName = "suave" | "normal" | "ultra";

type ProfileForm = {
  profileName: ProfileName;
  minMessageDelay: number;
  maxMessageDelay: number;
  messageFrequencyPerDay: number;
  typingIndicatorDuration: number;
  audioSimulationDuration: number;
  reactionProbability: number;
  imageSendProbability: number;
};

const profileOrder: ProfileName[] = ["suave", "normal", "ultra"];

const profileDescriptions: Record<ProfileName, string> = {
  suave: "Cadência mais humana e espaçada, ideal para aquecimento gradual.",
  normal: "Equilíbrio entre naturalidade e volume de interação.",
  ultra: "Fluxo agressivo com menor intervalo e maior intensidade operacional.",
};

export default function Profiles() {
  const { isAuthenticated, loading } = useAuth({
    redirectOnUnauthenticated: true,
    redirectPath: "/login",
  });
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: profiles = [], isLoading } = trpc.maturation.listProfiles.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const upsertMutation = trpc.maturation.upsertProfile.useMutation();
  const [forms, setForms] = useState<Record<ProfileName, ProfileForm> | null>(null);

  useEffect(() => {
    if (profiles.length > 0) {
      const nextForms = profiles.reduce((acc, profile) => {
        acc[profile.profileName as ProfileName] = {
          profileName: profile.profileName as ProfileName,
          minMessageDelay: profile.minMessageDelay,
          maxMessageDelay: profile.maxMessageDelay,
          messageFrequencyPerDay: profile.messageFrequencyPerDay,
          typingIndicatorDuration: profile.typingIndicatorDuration,
          audioSimulationDuration: profile.audioSimulationDuration,
          reactionProbability: profile.reactionProbability,
          imageSendProbability: profile.imageSendProbability,
        };
        return acc;
      }, {} as Record<ProfileName, ProfileForm>);

      setForms(nextForms);
    }
  }, [profiles]);

  const orderedProfiles = useMemo(() => {
    if (!forms) return [];
    return profileOrder.map((profileName) => forms[profileName]).filter(Boolean);
  }, [forms]);

  const updateField = (profileName: ProfileName, field: keyof ProfileForm, value: number) => {
    setForms((current) => {
      if (!current) return current;
      return {
        ...current,
        [profileName]: {
          ...current[profileName],
          [field]: value,
        },
      };
    });
  };

  const saveProfile = async (profileName: ProfileName) => {
    if (!forms) return;

    const profile = forms[profileName];
    if (profile.minMessageDelay > profile.maxMessageDelay) {
      sonnerToast.error("O delay mínimo não pode ser maior que o máximo.");
      return;
    }

    try {
      await upsertMutation.mutateAsync(profile);
      await utils.maturation.listProfiles.invalidate();
      sonnerToast.success(`Perfil ${profileName} atualizado com sucesso.`);
    } catch (error) {
      sonnerToast.error(`Falha ao salvar perfil ${profileName}.`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Card className="card-premium-enhanced p-8 text-center">
          <p className="text-cyan-400 font-semibold">Carregando perfis...</p>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black text-white font-poppins overflow-hidden">
      <div className="fixed inset-0 opacity-5 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(0deg, transparent 24%, rgba(0, 255, 255, 0.1) 25%, rgba(0, 255, 255, 0.1) 26%, transparent 27%, transparent 74%, rgba(0, 255, 255, 0.1) 75%, rgba(0, 255, 255, 0.1) 76%, transparent 77%, transparent),
                             linear-gradient(90deg, transparent 24%, rgba(0, 255, 255, 0.1) 25%, rgba(0, 255, 255, 0.1) 26%, transparent 27%, transparent 74%, rgba(0, 255, 255, 0.1) 75%, rgba(0, 255, 255, 0.1) 76%, transparent 77%, transparent)`,
            backgroundSize: "80px 80px",
          }}
        />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-10">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8">
          <div>
            <h1 className="text-4xl font-orbitron font-bold neon-glow-cyan mb-2">PERFIS DE MATURAÇÃO W.M.S.E</h1>
            <p className="text-gray-400">
              M13 Group • ajuste o comportamento dos perfis `suave`, `normal` e `ultra`.
            </p>
          </div>

          <Button className="btn-primary-modern" onClick={() => setLocation("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao painel operacional
          </Button>
        </div>

        <Card className="card-premium-enhanced p-6 mb-8">
          <div className="status-banner status-banner-ok">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">Perfis de maturação carregados</p>
                <p className="text-sm text-gray-300 mt-1">
                  Ajuste delays, frequência e probabilidades com cuidado. Os perfis impactam diretamente a cadência operacional.
                </p>
              </div>
              <Button variant="outline" className="subtle-action" onClick={() => setLocation("/operations")}>
                Ir para Operação
              </Button>
            </div>

            <div className="summary-grid mt-4">
              <div className="summary-pill">
                <p className="summary-pill-label">Perfis</p>
                <p className="summary-pill-value">{orderedProfiles.length}</p>
              </div>
              <div className="summary-pill">
                <p className="summary-pill-label">Modo mais leve</p>
                <p className="summary-pill-value">suave</p>
              </div>
              <div className="summary-pill">
                <p className="summary-pill-label">Modo padrão</p>
                <p className="summary-pill-value">normal</p>
              </div>
              <div className="summary-pill">
                <p className="summary-pill-label">Modo intenso</p>
                <p className="summary-pill-value">ultra</p>
              </div>
            </div>
          </div>
        </Card>

        {isLoading || !forms ? (
          <Card className="card-premium-enhanced p-10 text-center text-gray-400">
            Carregando perfis...
          </Card>
        ) : (
          <div className="grid-3d">
            {orderedProfiles.map((profile) => (
              <Card key={profile.profileName} className="card-premium-enhanced p-6">
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-3">
                    <SlidersHorizontal className="w-5 h-5 text-cyan-400" />
                    <h2 className="text-2xl font-bold capitalize text-white">{profile.profileName}</h2>
                  </div>
                  <p className="text-sm text-gray-400">
                    {profileDescriptions[profile.profileName]}
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs uppercase text-gray-400 mb-2">Delay mínimo</p>
                      <Input
                        type="number"
                        value={profile.minMessageDelay}
                        onChange={(e) =>
                          updateField(profile.profileName, "minMessageDelay", Number(e.target.value))
                        }
                        className="field-control"
                      />
                    </div>
                    <div>
                      <p className="text-xs uppercase text-gray-400 mb-2">Delay máximo</p>
                      <Input
                        type="number"
                        value={profile.maxMessageDelay}
                        onChange={(e) =>
                          updateField(profile.profileName, "maxMessageDelay", Number(e.target.value))
                        }
                        className="field-control"
                      />
                    </div>
                  </div>

                  <div>
                    <p className="text-xs uppercase text-gray-400 mb-2">Mensagens por dia</p>
                    <Input
                      type="number"
                      value={profile.messageFrequencyPerDay}
                      onChange={(e) =>
                        updateField(profile.profileName, "messageFrequencyPerDay", Number(e.target.value))
                      }
                      className="field-control"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs uppercase text-gray-400 mb-2">Tempo digitando</p>
                      <Input
                        type="number"
                        value={profile.typingIndicatorDuration}
                        onChange={(e) =>
                          updateField(profile.profileName, "typingIndicatorDuration", Number(e.target.value))
                        }
                        className="field-control"
                      />
                    </div>
                    <div>
                      <p className="text-xs uppercase text-gray-400 mb-2">Simulação de áudio</p>
                      <Input
                        type="number"
                        value={profile.audioSimulationDuration}
                        onChange={(e) =>
                          updateField(profile.profileName, "audioSimulationDuration", Number(e.target.value))
                        }
                        className="field-control"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs uppercase text-gray-400 mb-2">Chance de reação (%)</p>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={profile.reactionProbability}
                        onChange={(e) =>
                          updateField(profile.profileName, "reactionProbability", Number(e.target.value))
                        }
                        className="field-control"
                      />
                    </div>
                    <div>
                      <p className="text-xs uppercase text-gray-400 mb-2">Chance de imagem (%)</p>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={profile.imageSendProbability}
                        onChange={(e) =>
                          updateField(profile.profileName, "imageSendProbability", Number(e.target.value))
                        }
                        className="field-control"
                      />
                    </div>
                  </div>
                </div>

                <div className="surface-item-compact mt-5">
                  <p className="text-xs text-gray-400 uppercase tracking-[0.08em] mb-1">Leitura rápida</p>
                  <p className="text-sm text-gray-300">
                    {profile.profileName === "suave" && "Use para aquecimento mais leve e menos insistente."}
                    {profile.profileName === "normal" && "Use como padrão principal para operação equilibrada."}
                    {profile.profileName === "ultra" && "Use apenas quando a base estiver estável e a pressão operacional estiver controlada."}
                  </p>
                </div>

                <Button
                  className="btn-primary-modern w-full mt-6"
                  onClick={() => saveProfile(profile.profileName)}
                  disabled={upsertMutation.isPending}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Salvar perfil
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
