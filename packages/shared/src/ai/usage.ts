import { BookmarkProcessingUsage } from "../types";

export function toProcessingUsage(
  usage: unknown,
  providerMetadata?: unknown
): BookmarkProcessingUsage | undefined {
  const normalizedProviderMetadata = normalizeProviderMetadata(providerMetadata);
  const rawUsage = isRecord(usage) ? usage : {};

  const processingUsage: BookmarkProcessingUsage = {
    inputTokens: numberValue(
      rawUsage.inputTokens ?? rawUsage.promptTokens ?? rawUsage.input_tokens
    ),
    outputTokens: numberValue(
      rawUsage.outputTokens ??
        rawUsage.completionTokens ??
        rawUsage.output_tokens
    ),
    totalTokens: numberValue(rawUsage.totalTokens ?? rawUsage.total_tokens),
    reasoningTokens: numberValue(
      rawUsage.reasoningTokens ?? rawUsage.reasoning_tokens
    ),
    cachedInputTokens: numberValue(
      rawUsage.cachedInputTokens ?? rawUsage.cached_input_tokens
    ),
    costUsd: costValue(normalizedProviderMetadata),
    providerMetadata: normalizedProviderMetadata,
  };

  const hasUsage =
    processingUsage.inputTokens !== undefined ||
    processingUsage.outputTokens !== undefined ||
    processingUsage.totalTokens !== undefined ||
    processingUsage.reasoningTokens !== undefined ||
    processingUsage.cachedInputTokens !== undefined ||
    processingUsage.costUsd !== undefined ||
    processingUsage.providerMetadata !== undefined;

  return hasUsage ? processingUsage : undefined;
}

function normalizeProviderMetadata(
  providerMetadata: unknown
): Record<string, any> | undefined {
  return isRecord(providerMetadata)
    ? (providerMetadata as Record<string, any>)
    : undefined;
}

function costValue(providerMetadata?: Record<string, any>): string | undefined {
  if (!providerMetadata) return undefined;

  const candidates = [
    providerMetadata.openrouter?.usage?.cost,
    providerMetadata.openrouter?.cost,
    providerMetadata.usage?.cost,
    providerMetadata.cost,
  ];

  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null) continue;
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return formatCost(candidate);
    }
    if (typeof candidate === "string" && candidate.trim() !== "") {
      const numeric = Number(candidate);
      return Number.isFinite(numeric) ? formatCost(numeric) : candidate;
    }
  }

  return undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function formatCost(cost: number): string {
  return cost.toFixed(10).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null;
}
