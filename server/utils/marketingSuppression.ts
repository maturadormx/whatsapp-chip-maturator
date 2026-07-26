import fs from "node:fs";
import path from "node:path";

export interface MarketingSuppressionRecord {
  id: string;
  userId: number;
  value: string;
  reason?: string;
  tag?: string;
  createdAt: string;
}

const marketingSuppressionFilePath = path.resolve(process.cwd(), "server", "marketing-suppression.json");
let cachedSuppression: MarketingSuppressionRecord[] | null = null;

function readSuppressionFile() {
  if (cachedSuppression) return cachedSuppression;
  try {
    if (fs.existsSync(marketingSuppressionFilePath)) {
      const parsed = JSON.parse(fs.readFileSync(marketingSuppressionFilePath, "utf-8")) as MarketingSuppressionRecord[];
      cachedSuppression = Array.isArray(parsed) ? parsed : [];
      return cachedSuppression;
    }
  } catch (error) {
    console.error("[MarketingSuppression] Falha ao ler supressão.", error);
  }
  cachedSuppression = [];
  return cachedSuppression;
}

function writeSuppressionFile(records: MarketingSuppressionRecord[]) {
  fs.writeFileSync(marketingSuppressionFilePath, JSON.stringify(records, null, 2), "utf-8");
  cachedSuppression = records;
}

function normalizeValue(value: string) {
  return value.replace(/\D/g, "").trim();
}

export function listMarketingSuppressionEntries(userId: number) {
  return readSuppressionFile()
    .filter((entry) => entry.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function addMarketingSuppressionEntry(userId: number, input: { value: string; reason?: string; tag?: string }) {
  const value = normalizeValue(input.value);
  if (!value) {
    throw new Error("Número inválido para supressão.");
  }

  const current = readSuppressionFile();
  const exists = current.find((entry) => entry.userId === userId && entry.value === value);
  if (exists) return exists;

  const nextRecord: MarketingSuppressionRecord = {
    id: `supp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    value,
    reason: input.reason?.trim() || undefined,
    tag: input.tag?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };

  current.push(nextRecord);
  writeSuppressionFile(current);
  return nextRecord;
}

export function removeMarketingSuppressionEntry(userId: number, suppressionId: string) {
  const current = readSuppressionFile();
  const next = current.filter((entry) => !(entry.userId === userId && entry.id === suppressionId));
  writeSuppressionFile(next);
  return { success: true } as const;
}
