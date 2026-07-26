import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { RawBehaviorEvent } from "../../server/services/evidenceNormalizerService";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const syntheticDir = path.join(rootDir, "datasets", "synthetic");

type DatasetShape = {
  datasetId: string;
  description: string;
  replayedAt: string;
  rawEvents: RawBehaviorEvent[];
};

type PresetFactory = () => DatasetShape;

function at(hour: number, minute: number) {
  return new Date(Date.UTC(2026, 6, 16, hour, minute, 0)).toISOString();
}

function contactEvent(
  eventType: string,
  occurredAt: string,
  direction: "inbound" | "outbound" | "system",
  overrides: Partial<RawBehaviorEvent> = {}
): RawBehaviorEvent {
  return {
    eventType,
    source: direction === "outbound" ? "synthetic_outbound" : direction === "inbound" ? "messages.upsert" : "synthetic_system",
    direction,
    occurredAt,
    remoteJid: overrides.remoteJid ?? "5511999999999@s.whatsapp.net",
    remoteType: overrides.remoteType ?? "contact",
    remoteLabel: overrides.remoteLabel ?? "Contato Sintético",
    ...overrides,
  };
}

const presets: Record<string, PresetFactory> = {
  "responde-rapido": () => ({
    datasetId: "synthetic-responde-rapido",
    description: "Recebe e responde com atraso mínimo.",
    replayedAt: at(18, 0),
    rawEvents: [
      contactEvent("message_received", at(10, 0), "inbound"),
      contactEvent("message_sent", at(10, 2), "outbound"),
      contactEvent("messages_read", at(10, 3), "inbound"),
    ],
  }),
  "responde-lento": () => ({
    datasetId: "synthetic-responde-lento",
    description: "Recebe e responde com grande atraso.",
    replayedAt: at(18, 0),
    rawEvents: [
      contactEvent("message_received", at(9, 0), "inbound"),
      contactEvent("message_sent", at(12, 30), "outbound"),
    ],
  }),
  "entra-em-grupo": () => ({
    datasetId: "synthetic-entra-em-grupo",
    description: "Entrada e navegação em grupo.",
    replayedAt: at(18, 0),
    rawEvents: [
      contactEvent("group_joined", at(14, 0), "system", {
        groupJid: "120363000000100@g.us",
        groupSubject: "Grupo Sintético",
        remoteJid: null,
        remoteType: "group",
      }),
      contactEvent("group_opened", at(14, 5), "system", {
        groupJid: "120363000000100@g.us",
        groupSubject: "Grupo Sintético",
        remoteJid: null,
        remoteType: "group",
      }),
    ],
  }),
  "ignora-mensagens": () => ({
    datasetId: "synthetic-ignora-mensagens",
    description: "Recebe mensagens e não responde.",
    replayedAt: at(18, 0),
    rawEvents: [
      contactEvent("message_received", at(11, 0), "inbound"),
      contactEvent("message_received", at(11, 8), "inbound"),
      contactEvent("chat_list_opened", at(11, 10), "system", { remoteJid: null, remoteType: null }),
    ],
  }),
  "so-posta-status": () => ({
    datasetId: "synthetic-so-posta-status",
    description: "Perfil focado em status e pouca conversa.",
    replayedAt: at(18, 0),
    rawEvents: [
      contactEvent("status_viewed", at(8, 0), "system"),
      contactEvent("status_viewed", at(12, 0), "system"),
      contactEvent("status_viewed", at(20, 0), "system"),
    ],
  }),
  "so-observa": () => ({
    datasetId: "synthetic-so-observa",
    description: "Passividade com leitura e observação.",
    replayedAt: at(18, 0),
    rawEvents: [
      contactEvent("messages_read", at(9, 10), "inbound"),
      contactEvent("status_viewed", at(9, 20), "system"),
      contactEvent("profile_name_updated", at(9, 30), "system", { remoteJid: null, remoteType: null }),
    ],
  }),
  "so-recebe": () => ({
    datasetId: "synthetic-so-recebe",
    description: "Somente inbound sem ação ativa.",
    replayedAt: at(18, 0),
    rawEvents: [
      contactEvent("message_received", at(7, 30), "inbound"),
      contactEvent("message_received", at(13, 45), "inbound"),
      contactEvent("message_received", at(21, 10), "inbound"),
    ],
  }),
  "alta-atividade": () => ({
    datasetId: "synthetic-alta-atividade",
    description: "Múltiplas ações ao longo do dia.",
    replayedAt: at(23, 0),
    rawEvents: [
      contactEvent("session_connected", at(7, 0), "system", { remoteJid: null, remoteType: null }),
      contactEvent("message_received", at(8, 10), "inbound"),
      contactEvent("message_sent", at(8, 12), "outbound"),
      contactEvent("group_opened", at(11, 0), "system", {
        groupJid: "120363000000101@g.us",
        groupSubject: "Grupo Alta Atividade",
        remoteJid: null,
        remoteType: "group",
      }),
      contactEvent("status_viewed", at(14, 20), "system"),
      contactEvent("message_received", at(18, 5), "inbound", {
        remoteJid: "5511888888888@s.whatsapp.net",
        remoteLabel: "Contato 2",
      }),
      contactEvent("message_sent", at(18, 9), "outbound", {
        remoteJid: "5511888888888@s.whatsapp.net",
        remoteLabel: "Contato 2",
      }),
    ],
  }),
  "baixa-atividade": () => ({
    datasetId: "synthetic-baixa-atividade",
    description: "Baixa atividade e pouca diversidade.",
    replayedAt: at(23, 0),
    rawEvents: [
      contactEvent("session_connected", at(10, 0), "system", { remoteJid: null, remoteType: null }),
      contactEvent("chat_list_opened", at(10, 5), "system", { remoteJid: null, remoteType: null }),
    ],
  }),
};

function readArg(name: string) {
  const prefix = `${name}=`;
  return process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function writeDataset(dataset: DatasetShape) {
  await mkdir(syntheticDir, { recursive: true });
  const filePath = path.join(syntheticDir, `${dataset.datasetId}.json`);
  await writeFile(filePath, JSON.stringify(dataset, null, 2), "utf8");
  console.log(`Synthetic dataset gerado: ${path.relative(rootDir, filePath)}`);
}

async function main() {
  const profile = readArg("profile");

  if (profile) {
    const preset = presets[profile];
    if (!preset) {
      throw new Error(`perfil desconhecido: ${profile}`);
    }
    await writeDataset(preset());
    return;
  }

  for (const preset of Object.values(presets)) {
    await writeDataset(preset());
  }

  console.log(`Total de datasets sintéticos gerados: ${Object.keys(presets).length}`);
}

void main();
