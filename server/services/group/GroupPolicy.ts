import type { ChipPersonaRecord } from "../persona/PersonaRepository";

export type GroupActionCandidate =
  | { action: "join_group"; probability: number; reason: string; inviteLink: string; origin: "manual_invite" | "catalog"; risk: number; category?: string | null }
  | { action: "create_group"; probability: number; reason: string; subject: string; participants: string[]; origin: "internal" }
  | { action: "open_group"; probability: number; reason: string; groupJid: string }
  | { action: "leave_group"; probability: number; reason: string; groupJid: string }
  | { action: "do_nothing"; probability: number; reason: string };

const INTERNAL_GROUP_NAMES = [
  "Família",
  "Trabalho",
  "Clientes",
  "Futebol",
  "Amigos",
];

function buildPromotionsGroupName(city: string) {
  return `Promoções ${city}`;
}

function pickSubject(persona: ChipPersonaRecord) {
  if (persona.interests.includes("futebol")) return "Futebol";
  if (persona.interests.includes("empreendedorismo")) return "Clientes";
  if (persona.weekendProfile === "família") return "Família";
  if (persona.profession.toLowerCase().includes("comercial")) return "Trabalho";
  return buildPromotionsGroupName(persona.homeCity);
}

export function chooseGroupCandidate(params: {
  persona: ChipPersonaRecord;
  joinedGroups: Array<{ groupJid: string; status: string; risk: number; inviteLink?: string | null; category?: string | null }>;
  manualGroupTargets: Array<{ targetValue: string; targetName: string }>;
  catalogGroups: Array<{ link: string | null; category: string; risk: number }>;
  siblingChipNumbers: string[];
  availableLiveGroups: Array<{ id: string }>;
}) {
  const activeGroups = params.joinedGroups.filter((group) => group.status === "joined" && !group.groupJid.includes("candidate:"));
  const candidateGroups = params.joinedGroups.filter((group) => group.status === "candidate");

  const manualInvite = params.manualGroupTargets.find((group) => Boolean(group.targetValue?.trim()));
  if (activeGroups.length === 0 && manualInvite) {
    return {
      action: "join_group",
      probability: 0.18,
      reason: "Convite manual disponível; é a forma mais controlada de iniciar vida social do chip.",
      inviteLink: manualInvite.targetValue,
      origin: "manual_invite",
      risk: 8,
      category: manualInvite.targetName,
    } satisfies GroupActionCandidate;
  }

  const catalogCandidate = params.catalogGroups.find(
    (group) => Boolean(group.link?.trim()) && group.risk <= 45
  );
  if (activeGroups.length < 2 && catalogCandidate) {
    return {
      action: "join_group",
      probability: 0.12,
      reason: "Há grupo curado compatível com risco aceitável para ampliar a malha social.",
      inviteLink: catalogCandidate.link!,
      origin: "catalog",
      risk: catalogCandidate.risk,
      category: catalogCandidate.category,
    } satisfies GroupActionCandidate;
  }

  const uniqueParticipants = Array.from(new Set(params.siblingChipNumbers.filter(Boolean))).slice(0, 4);
  if (activeGroups.length === 0 && uniqueParticipants.length >= 2) {
    return {
      action: "create_group",
      probability: 0.16,
      reason: `Há chips irmãos suficientes no eixo ${params.persona.primaryDDD}/${params.persona.homeCity} para um grupo interno plausível.`,
      subject: INTERNAL_GROUP_NAMES.includes(pickSubject(params.persona))
        ? pickSubject(params.persona)
        : buildPromotionsGroupName(params.persona.homeCity),
      participants: uniqueParticipants,
      origin: "internal",
    } satisfies GroupActionCandidate;
  }

  const activeOrLiveGroup = activeGroups[0]?.groupJid || params.availableLiveGroups[0]?.id;
  if (activeOrLiveGroup) {
    return {
      action: "open_group",
      probability: 0.28,
      reason: "O chip já tem superfície social suficiente para observação leve de grupo.",
      groupJid: activeOrLiveGroup,
    } satisfies GroupActionCandidate;
  }

  const riskyGroup = candidateGroups.find((group) => group.risk >= 70 && group.groupJid);
  if (riskyGroup) {
    return {
      action: "leave_group",
      probability: 0.08,
      reason: "Grupo sinalizado como arriscado; sair preserva a curva de maturação.",
      groupJid: riskyGroup.groupJid,
    } satisfies GroupActionCandidate;
  }

  return {
    action: "do_nothing",
    probability: 0.2,
    reason: "Nenhuma oportunidade social de grupo justificou ação agora.",
  } satisfies GroupActionCandidate;
}
