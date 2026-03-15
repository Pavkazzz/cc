export async function computeCacheKey(
  json: unknown,
  width: number,
  height: number,
  scale: number,
  background: string | null = null
): Promise<string> {
  const keyObj: Record<string, unknown> = { json, width, height, scale };
  if (background !== null) keyObj.background = background;
  const payload = JSON.stringify(
    keyObj,
    (_key: string, value: unknown) => {
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        return Object.keys(value as Record<string, unknown>)
          .sort()
          .reduce<Record<string, unknown>>((sorted, k) => {
            sorted[k] = (value as Record<string, unknown>)[k];
            return sorted;
          }, {});
      }
      return value;
    }
  );

  const data = new TextEncoder().encode(payload);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
