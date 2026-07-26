import type { ChipLifeState, ChipState } from "./types";

const validTransitions = new Map<ChipState, ReadonlySet<ChipState>>([
  ["CRIADO", new Set<ChipState>(["PAREADO", "INCIDENTE", "ENCERRADO"])],
  ["PAREADO", new Set<ChipState>(["NOVO", "INCIDENTE", "ENCERRADO"])],
  ["NOVO", new Set<ChipState>(["EM_MATURACAO", "INCIDENTE", "ENCERRADO"])],
  ["EM_MATURACAO", new Set<ChipState>(["MADURO", "INCIDENTE", "ENCERRADO"])],
  ["MADURO", new Set<ChipState>(["INCIDENTE", "ENCERRADO"])],
  ["INCIDENTE", new Set<ChipState>(["DIAGNOSTICO", "ENCERRADO"])],
  ["DIAGNOSTICO", new Set<ChipState>(["RECUPERACAO", "ENCERRADO"])],
  ["RECUPERACAO", new Set<ChipState>(["ISOLADO", "ENCERRADO"])],
  ["ISOLADO", new Set<ChipState>(["RECUPERACAO", "ENCERRADO"])],
  ["ENCERRADO", new Set<ChipState>()],
]);

const lifeStateSet = new Set<ChipLifeState>(["CRIADO", "PAREADO", "NOVO", "EM_MATURACAO", "MADURO"]);

export function canTransition(fromState: ChipState | null, toState: ChipState): boolean {
  if (fromState === null) {
    return toState === "CRIADO";
  }

  return validTransitions.get(fromState)?.has(toState) ?? false;
}

export function isLifeState(state: ChipState | null): state is ChipLifeState {
  return state !== null && lifeStateSet.has(state as ChipLifeState);
}
