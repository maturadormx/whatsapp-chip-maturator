export function splitMessageLibraryInput(rawContent: string) {
  const normalized = rawContent.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const blocks = normalized
    .split(/\n\s*---+\s*\n|\n{2,}/g)
    .map((item) => item.trim())
    .filter(Boolean);

  const unique = new Set<string>();
  const result: string[] = [];

  for (const block of blocks) {
    if (!unique.has(block)) {
      unique.add(block);
      result.push(block);
    }
  }

  return result;
}

export function pickRotatingMessage(messages: string[], recentMessages: string[] = []) {
  const sanitizedMessages = messages.map((item) => item.trim()).filter(Boolean);
  if (sanitizedMessages.length === 0) {
    throw new Error("Nenhuma mensagem disponível para rotação.");
  }

  const recentSet = new Set(recentMessages.map((item) => item.trim()).filter(Boolean));
  const nonRecentMessages = sanitizedMessages.filter((item) => !recentSet.has(item));
  const pool = nonRecentMessages.length > 0 ? nonRecentMessages : sanitizedMessages;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function pickRotatingMessageAdvanced(
  messages: string[],
  options?: {
    recentMessages?: string[];
    recentMessagesForTarget?: string[];
    usageCounts?: Record<string, number>;
  }
) {
  const sanitizedMessages = messages.map((item) => item.trim()).filter(Boolean);
  if (sanitizedMessages.length === 0) {
    throw new Error("Nenhuma mensagem disponível para rotação.");
  }

  const recentGlobalSet = new Set((options?.recentMessages || []).map((item) => item.trim()).filter(Boolean));
  const recentTargetSet = new Set((options?.recentMessagesForTarget || []).map((item) => item.trim()).filter(Boolean));
  const usageCounts = options?.usageCounts || {};

  let candidatePool = sanitizedMessages.filter((item) => !recentTargetSet.has(item));
  if (candidatePool.length === 0) {
    candidatePool = sanitizedMessages.filter((item) => !recentGlobalSet.has(item));
  }
  if (candidatePool.length === 0) {
    candidatePool = sanitizedMessages;
  }

  const scoredPool = candidatePool.map((message) => ({
    message,
    score:
      (recentTargetSet.has(message) ? 100 : 0) +
      (recentGlobalSet.has(message) ? 10 : 0) +
      (usageCounts[message] || 0),
  }));

  const bestScore = Math.min(...scoredPool.map((item) => item.score));
  const bestCandidates = scoredPool.filter((item) => item.score === bestScore).map((item) => item.message);
  return bestCandidates[Math.floor(Math.random() * bestCandidates.length)];
}
