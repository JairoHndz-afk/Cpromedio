export function readBoundedPositiveInt(value, fallback, options = {}) {
  const min = Number.isFinite(options.min) ? Number(options.min) : 1;
  const max = Number.isFinite(options.max) ? Number(options.max) : Number.MAX_SAFE_INTEGER;
  const safeFallback = Math.min(max, Math.max(min, Math.trunc(Number(fallback) || min)));
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return safeFallback;
  }

  return Math.min(max, Math.max(min, Math.trunc(numericValue)));
}
