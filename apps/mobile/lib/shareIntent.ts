type ShareIntentValue = unknown;

const URL_REGEX = /(https?:\/\/[^\s,;)]+)/g;

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function getNestedRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function extractSharedUrl(shareIntent: ShareIntentValue): string | null {
  const intent = getNestedRecord(shareIntent);
  if (!intent) return null;

  const meta = getNestedRecord(intent.meta);
  const weburls = Array.isArray(intent.weburls) ? intent.weburls : [];
  const weburlValues = weburls
    .map((weburl) => getNestedRecord(weburl)?.url)
    .filter(Boolean);

  const possibleValues = [
    intent.url,
    intent.webUrl,
    intent.text,
    meta?.url,
    meta?.webUrl,
    intent.uri,
    intent.data,
    ...weburlValues,
  ];

  for (const value of possibleValues) {
    const text = stringValue(value);
    const match = text?.match(URL_REGEX);
    if (match?.[0]) return match[0];
  }

  return null;
}

export function buildShareRoute(shareIntent: ShareIntentValue): string | null {
  const sharedUrl = extractSharedUrl(shareIntent);
  return sharedUrl ? `/share?url=${encodeURIComponent(sharedUrl)}` : null;
}
