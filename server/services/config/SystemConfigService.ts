import { getSystemConfigByKey, upsertSystemConfig } from "../../db";

export async function getSystemConfigValue<T = unknown>(key: string, fallback: T): Promise<T> {
  const row = await getSystemConfigByKey(key);
  if (!row) {
    return fallback;
  }

  if (row.valueType === "number") {
    return Number(row.valueNumber ?? fallback) as T;
  }
  if (row.valueType === "boolean") {
    return Boolean(row.valueBoolean) as T;
  }
  if (row.valueType === "json") {
    return (row.payload ?? fallback) as T;
  }
  return (row.valueText ?? fallback) as T;
}

export async function setSystemConfigValue(params: {
  key: string;
  value: string | number | boolean | Record<string, unknown> | Array<unknown>;
  description?: string | null;
}) {
  const valueType =
    typeof params.value === "number"
      ? "number"
      : typeof params.value === "boolean"
        ? "boolean"
        : typeof params.value === "string"
          ? "string"
          : "json";

  return upsertSystemConfig({
    configKey: params.key,
    valueType,
    valueText: typeof params.value === "string" ? params.value : null,
    valueNumber: typeof params.value === "number" ? params.value : null,
    valueBoolean: typeof params.value === "boolean" ? params.value : null,
    payload: typeof params.value === "object" ? params.value : null,
    description: params.description ?? null,
  });
}
