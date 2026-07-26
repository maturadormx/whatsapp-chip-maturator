import type { ChipMaturityStatus } from "../maturityPolicy";
import type { ChipPersonaRecord } from "../persona/PersonaRepository";

export type BehaviorPlannerAction =
  | "contacts_synced"
  | "contact_added"
  | "join_group"
  | "create_group"
  | "open_group"
  | "read_group_messages"
  | "leave_group"
  | "presence_online"
  | "presence_offline"
  | "presence_reading"
  | "presence_typing"
  | "presence_recording"
  | "presence_away"
  | "conversation_reply"
  | "conversation_emoji"
  | "conversation_reaction"
  | "identity_name_refresh"
  | "identity_about_refresh"
  | "identity_photo_refresh"
  | "profile_name_updated"
  | "about_updated"
  | "wake_up"
  | "chat_list_opened"
  | "status_viewed"
  | "group_opened"
  | "idle"
  | "sleep"
  | "paused"
  | "waiting_connection"
  | "do_nothing";

export interface BehaviorPlan {
  engine:
    | "contact_behavior"
    | "group_behavior"
    | "presence_behavior"
    | "conversation_behavior"
    | "identity_behavior"
    | "passive_behavior"
    | "none";
  action: BehaviorPlannerAction;
  probability: number;
  reason: string;
  context: {
    localHour: number;
    weekday: number;
    personaMode: string;
  };
  metadata?: {
    primaryDDD?: string;
    secondaryDDDs?: string[];
    availableGroupsCount?: number;
    availableContactTargetsCount?: number;
    availableGroupTargetsCount?: number;
    joinedGroupsCount?: number;
    recentInboundCount?: number;
    consecutiveContactAdds?: number;
    targetJid?: string;
  };
}

export interface BehaviorPlannerInput {
  persona: ChipPersonaRecord;
  phase: ChipMaturityStatus;
  now?: Date;
  runtimeState: {
    isPaused: boolean;
    isConnected: boolean;
  };
  recentEvents: Array<{
    eventType: string;
    occurredAt?: Date | string | null;
    remoteJid?: string | null;
    messageId?: string | null;
    contentPreview?: string | null;
  }>;
  certification?: {
    status?: string | null;
    usable?: boolean | number | null;
    reason?: string | null;
  } | null;
  availableGroupsCount?: number;
  availableContactTargetsCount?: number;
  availableGroupTargetsCount?: number;
  joinedGroupsCount?: number;
  recentInboundCount?: number;
  chipCreatedAt?: Date | string | null;
}

function hasEvent(events: BehaviorPlannerInput["recentEvents"], eventType: string) {
  return events.some((event) => event.eventType === eventType);
}

function countConsecutiveContactAdds(events: BehaviorPlannerInput["recentEvents"]) {
  let count = 0;
  for (const event of events) {
    if (event.eventType === "contact_added") {
      count += 1;
      continue;
    }
    break;
  }
  return count;
}

function isWithinWakeWindow(persona: ChipPersonaRecord, localHour: number) {
  if (persona.sleepHour > persona.wakeHour) {
    return localHour >= persona.wakeHour && localHour < persona.sleepHour;
  }
  return localHour >= persona.wakeHour || localHour < persona.sleepHour;
}

function clampProbability(value: number) {
  return Math.max(0.05, Math.min(0.98, Number(value.toFixed(2))));
}

function buildPlan(
  input: BehaviorPlannerInput,
  action: BehaviorPlan["action"],
  engine: BehaviorPlan["engine"],
  probability: number,
  reason: string
): BehaviorPlan {
  const now = input.now ?? new Date();
  const lastInbound = input.recentEvents.find((event) => event.eventType === "message_received" && event.remoteJid);
  return {
    engine,
    action,
    probability: clampProbability(probability),
    reason,
    context: {
      localHour: now.getHours(),
      weekday: now.getDay(),
      personaMode: input.persona.socialProfile,
    },
    metadata: {
      primaryDDD: input.persona.primaryDDD,
      secondaryDDDs: input.persona.secondaryDDDs,
      availableGroupsCount: input.availableGroupsCount ?? 0,
      availableContactTargetsCount: input.availableContactTargetsCount ?? 0,
      availableGroupTargetsCount: input.availableGroupTargetsCount ?? 0,
      joinedGroupsCount: input.joinedGroupsCount ?? 0,
      recentInboundCount: input.recentInboundCount ?? 0,
      consecutiveContactAdds: countConsecutiveContactAdds(input.recentEvents),
      targetJid: lastInbound?.remoteJid ?? undefined,
    },
  };
}

export function planBehavior(input: BehaviorPlannerInput): BehaviorPlan {
  const now = input.now ?? new Date();
  const localHour = now.getHours();
  const weekday = now.getDay();
  const isWeekend = weekday === 0 || weekday === 6;
  const consecutiveContactAdds = countConsecutiveContactAdds(input.recentEvents);
  const insideWakeWindow = isWithinWakeWindow(input.persona, localHour);
  const availableGroupsCount = input.availableGroupsCount ?? 0;
  const availableContactTargetsCount = input.availableContactTargetsCount ?? 0;
  const availableGroupTargetsCount = input.availableGroupTargetsCount ?? 0;
  const joinedGroupsCount = input.joinedGroupsCount ?? 0;
  const recentInboundCount = input.recentInboundCount ?? 0;
  const chipAgeDays = input.chipCreatedAt ? Math.max(0, Math.floor((now.getTime() - new Date(input.chipCreatedAt).getTime()) / (24 * 60 * 60 * 1000))) : 0;
  const profileNameUpdates = input.recentEvents.filter((event) => event.eventType === "profile_name_updated").length;
  const aboutUpdates = input.recentEvents.filter((event) => event.eventType === "about_updated").length;
  const photoUpdates = input.recentEvents.filter((event) => event.eventType === "profile_photo_updated").length;

  if (input.runtimeState.isPaused) {
    return buildPlan(input, "paused", "none", 0.99, "Chip pausado; nenhuma ação operacional faz sentido agora.");
  }

  if (!input.runtimeState.isConnected) {
    return buildPlan(input, "waiting_connection", "none", 0.99, "Sessão desconectada; o próximo passo coerente é aguardar reconexão.");
  }

  if (!hasEvent(input.recentEvents, "contacts_synced")) {
    return buildPlan(input, "contacts_synced", "contact_behavior", 0.98, "Primeiro ciclo do chip ainda sem sincronização de contatos.");
  }

  if (!hasEvent(input.recentEvents, "profile_name_updated")) {
    return buildPlan(
      input,
      "profile_name_updated",
      "passive_behavior",
      0.96,
      "A persona já existe, mas o nome visível ainda não foi alinhado ao perfil."
    );
  }

  if (!hasEvent(input.recentEvents, "about_updated")) {
    return buildPlan(
      input,
      "about_updated",
      "passive_behavior",
      0.94,
      "A bio ainda não refletiu a identidade da persona."
    );
  }

  if (!insideWakeWindow) {
    return buildPlan(
      input,
      "presence_offline",
      "presence_behavior",
      0.91,
      `Fora da janela natural da persona (${input.persona.wakeHour}h-${input.persona.sleepHour}h).`
    );
  }

  if (chipAgeDays >= 14 && photoUpdates < 1) {
    return buildPlan(
      input,
      "identity_photo_refresh",
      "identity_behavior",
      0.16,
      "A identidade do chip já tem idade suficiente para uma primeira troca de foto."
    );
  }

  if (chipAgeDays >= 10 && aboutUpdates < 2) {
    return buildPlan(
      input,
      "identity_about_refresh",
      "identity_behavior",
      0.2,
      "A bio ainda está estática demais para o tempo de vida do chip."
    );
  }

  if (chipAgeDays >= 7 && profileNameUpdates < 2) {
    return buildPlan(
      input,
      "identity_name_refresh",
      "identity_behavior",
      0.18,
      "Já faz sentido uma pequena evolução do nome visível do perfil."
    );
  }

  if (joinedGroupsCount === 0 && availableGroupTargetsCount > 0 && input.phase !== "RESTRITO" && input.phase !== "REPROVADO") {
    return buildPlan(
      input,
      "join_group",
      "group_behavior",
      0.18,
      "Há oportunidade de entrada em grupo antes de expandir a conversa direta."
    );
  }

  if (joinedGroupsCount === 0 && availableGroupsCount === 0 && input.phase !== "NOVO") {
    return buildPlan(
      input,
      "create_group",
      "group_behavior",
      0.16,
      "Ainda não existe superfície social de grupo; criar um grupo interno dá contexto ao chip."
    );
  }

  if (availableContactTargetsCount > 0 && input.phase !== "RESTRITO" && input.phase !== "REPROVADO") {
    if (consecutiveContactAdds >= 3) {
      return buildPlan(
        input,
        "idle",
        "passive_behavior",
        0.87,
        "Já houve uma sequência recente de adição de contatos; a melhor escolha agora é esfriar o ritmo."
      );
    }

    const businessHourBoost = localHour >= 8 && localHour <= 18 ? 0.18 : 0.04;
    const weekendPenalty =
      isWeekend && input.persona.weekendProfile === "caseiro"
        ? 0.14
        : isWeekend && input.persona.weekendProfile === "social"
          ? -0.04
          : 0;
    const profileBoost =
      input.persona.socialProfile === "sociável"
        ? 0.08
        : input.persona.socialProfile === "discreto"
          ? -0.06
          : 0;
    const probability = 0.62 + businessHourBoost + profileBoost - weekendPenalty;

    if (probability >= 0.72) {
      return buildPlan(
        input,
        "contact_added",
        "contact_behavior",
        probability,
        `Mesmo DDD-base (${input.persona.primaryDDD}) e janela compatível com a rotina da persona.`
      );
    }
  }

  if (recentInboundCount > 0) {
    if (input.persona.socialProfile === "discreto") {
      return buildPlan(
        input,
        "conversation_reaction",
        "conversation_behavior",
        0.34,
        "Contato inbound recente; a persona discreta tende a sinalizar presença antes de elaborar texto."
      );
    }

    if (input.persona.socialProfile === "observador") {
      return buildPlan(
        input,
        "conversation_emoji",
        "conversation_behavior",
        0.39,
        "Há inbound recente e a persona observadora responde com toque curto antes de conversa longa."
      );
    }

    return buildPlan(
      input,
      "conversation_reply",
      "conversation_behavior",
      0.51,
      "Recebeu mensagem; agora faz sentido ler, aparecer online e responder com contexto."
    );
  }

  if (availableGroupsCount > 0 && input.phase !== "NOVO") {
    return buildPlan(input, "group_opened", "passive_behavior", 0.31, "Há grupos disponíveis e a fase atual comporta observação social leve.");
  }

  if (!hasEvent(input.recentEvents, "wake_up")) {
    return buildPlan(input, "wake_up", "passive_behavior", 0.52, "Primeiro gesto coerente da janela ativa é marcar presença leve.");
  }

  if (localHour >= input.persona.sleepHour - 1) {
    return buildPlan(input, "presence_away", "presence_behavior", 0.58, "Janela final do dia da persona; faz mais sentido reduzir presença antes de encerrar.");
  }

  if (localHour >= input.persona.wakeHour && localHour <= input.persona.wakeHour + 2) {
    return buildPlan(input, "presence_online", "presence_behavior", 0.43, "Início do dia favorece uma janela curta de presença online irregular.");
  }

  if (input.persona.socialProfile === "observador" || input.persona.socialProfile === "discreto") {
    return buildPlan(input, "presence_reading", "presence_behavior", 0.38, "O perfil da persona favorece leitura e observação antes de qualquer exposição maior.");
  }

  if (availableGroupsCount > 0) {
    return buildPlan(input, "open_group", "group_behavior", 0.29, "Já existem grupos ativos; abrir um deles reforça presença social sem forçar conversa.");
  }

  return buildPlan(input, "presence_away", "presence_behavior", 0.35, "Não há oportunidade melhor agora; uma presença intermitente preserva o padrão humano.");
}
