export type SupportedTargetType = "number" | "group" | "list" | "chip";

function compactDigits(value: string) {
  return value.replace(/\D+/g, "");
}

export function normalizeNumberTarget(rawValue: string) {
  const digits = compactDigits(rawValue);

  if (!digits) {
    throw new Error("Número vazio ou inválido.");
  }

  if (digits.length < 10 || digits.length > 15) {
    throw new Error("Número inválido. Use entre 10 e 15 dígitos.");
  }

  return {
    input: rawValue,
    normalizedValue: digits,
    whatsappJid: `${digits}@s.whatsapp.net`,
    targetType: "number" as const,
  };
}

export function normalizeGroupTarget(rawValue: string) {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    throw new Error("Grupo vazio ou inválido.");
  }

  if (!trimmed.endsWith("@g.us")) {
    throw new Error("Grupo inválido. Use o identificador completo terminando em @g.us.");
  }

  const groupId = trimmed.slice(0, -5).trim();
  if (!groupId || groupId.length < 6) {
    throw new Error("Grupo inválido. O identificador antes de @g.us é muito curto.");
  }

  return {
    input: rawValue,
    normalizedValue: `${groupId}@g.us`,
    whatsappJid: `${groupId}@g.us`,
    targetType: "group" as const,
  };
}

export function normalizeTargetValue(rawValue: string, targetType: SupportedTargetType) {
  if (targetType === "chip") {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      throw new Error("Chip alvo inválido.");
    }
    return {
      input: rawValue,
      normalizedValue: trimmed,
      whatsappJid: trimmed,
      targetType: "chip" as const,
    };
  }

  if (targetType === "group") {
    return normalizeGroupTarget(rawValue);
  }

  return normalizeNumberTarget(rawValue);
}

export function normalizeTargetList(rawTargets: string[], targetType: "number" | "group" | "list") {
  const normalized = rawTargets.map((target) =>
    normalizeTargetValue(target, targetType === "list" ? "number" : targetType)
  );

  const uniqueByValue = new Map<string, (typeof normalized)[number]>();
  for (const item of normalized) {
    uniqueByValue.set(item.normalizedValue, item);
  }

  return Array.from(uniqueByValue.values());
}

export function toWhatsAppJid(rawValue: string, targetType: "number" | "group" | "list") {
  return normalizeTargetValue(rawValue, targetType === "list" ? "number" : targetType).whatsappJid;
}
