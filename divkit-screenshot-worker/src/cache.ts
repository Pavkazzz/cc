export interface CacheResult {
  png: ArrayBuffer;
  source: "cache-api" | "r2";
}

const CACHE_URL_PREFIX = "https://cache.internal/";

function cacheUrl(cacheKey: string): string {
  return `${CACHE_URL_PREFIX}${cacheKey}.png`;
}

export async function getCached(
  cacheKey: string,
  r2: R2Bucket,
  ctx: ExecutionContext
): Promise<CacheResult | null> {
  const url = cacheUrl(cacheKey);

  const l1 = await caches.default.match(new Request(url));
  if (l1) {
    return { png: await l1.arrayBuffer(), source: "cache-api" };
  }

  const l2 = await r2.get(cacheKey);
  if (l2) {
    const png = await l2.arrayBuffer();
    ctx.waitUntil(
      caches.default.put(
        new Request(url),
        new Response(png, {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "s-maxage=3600",
          },
        })
      )
    );
    return { png, source: "r2" };
  }

  return null;
}

export async function setCached(
  cacheKey: string,
  png: ArrayBuffer,
  r2: R2Bucket,
  ctx: ExecutionContext,
  ttl: number
): Promise<void> {
  const url = cacheUrl(cacheKey);

  ctx.waitUntil(
    r2.put(cacheKey, png, {
      httpMetadata: { contentType: "image/png" },
    })
  );

  ctx.waitUntil(
    caches.default.put(
      new Request(url),
      new Response(png, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": `s-maxage=${ttl}`,
        },
      })
    )
  );
}
