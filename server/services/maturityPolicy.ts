import { getChipCertification } from "../db";

export type ChipMaturityStatus =
  | "NOVO"
  | "EM_MATURACAO"
  | "EM_OBSERVACAO"
  | "APROVADO"
  | "RESTRITO"
  | "REPROVADO";

export type ChipAction =
  | "connect"
  | "sync_contacts"
  | "edit_profile"
  | "join_group"
  | "view_group"
  | "view_status"
  | "idle"
  | "send_behavior_message"
  | "send_campaign_message";

export interface ChipActionDecision {
  allowed: boolean;
  status: ChipMaturityStatus;
  reason: string;
}

function getDefaultReason(status: ChipMaturityStatus, action: ChipAction) {
  if (action === "send_campaign_message") {
    return "Campanhas só podem usar chips aprovados pelo Maturator.";
  }

  if (action === "send_behavior_message") {
    if (status === "NOVO" || status === "EM_MATURACAO") {
      return "Chip ainda em fase inicial. Nesta etapa o Maturator deve priorizar identidade, pausa, grupos, leitura e observação antes de enviar mensagens.";
    }

    if (status === "RESTRITO" || status === "REPROVADO") {
      return "Chip com restrição operacional. Envio bloqueado até estabilizar o ativo.";
    }
  }

  return "Ação bloqueada pela política de maturação do chip.";
}

export function evaluateChipActionByStatus(
  status: ChipMaturityStatus,
  action: ChipAction
): ChipActionDecision {
  const baseAllowedActions: ChipAction[] = [
    "connect",
    "sync_contacts",
    "edit_profile",
    "join_group",
    "view_group",
    "view_status",
    "idle",
  ];

  if (baseAllowedActions.includes(action)) {
    return {
      allowed: true,
      status,
      reason: "Ação permitida nesta fase do ciclo de maturação.",
    };
  }

  if (action === "send_behavior_message") {
    const allowed = status === "EM_OBSERVACAO" || status === "APROVADO";
    return {
      allowed,
      status,
      reason: allowed
        ? "Chip já pode iniciar interações controladas de comportamento."
        : getDefaultReason(status, action),
    };
  }

  if (action === "send_campaign_message") {
    const allowed = status === "APROVADO";
    return {
      allowed,
      status,
      reason: allowed
        ? "Chip aprovado para uso comercial."
        : getDefaultReason(status, action),
    };
  }

  return {
    allowed: false,
    status,
    reason: getDefaultReason(status, action),
  };
}

export async function evaluateChipAction(
  userId: number,
  chipId: number,
  action: ChipAction
): Promise<ChipActionDecision> {
  const certification = await getChipCertification(userId, chipId);
  const status = (certification?.status as ChipMaturityStatus | undefined) ?? "NOVO";
  return evaluateChipActionByStatus(status, action);
}
