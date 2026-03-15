export interface RequestLogEntry {
  hash: string;
  json: unknown;
  width: number;
  height: number;
  scale: number;
  background: string | null;
  createdAt: string;
}

const LOG_PREFIX = "requests/";

function metaKey(hash: string): string {
  return `${LOG_PREFIX}${hash}/meta.json`;
}

function pngKey(hash: string): string {
  return `${LOG_PREFIX}${hash}/screenshot.png`;
}

export async function saveRequestLog(
  r2: R2Bucket,
  ctx: ExecutionContext,
  hash: string,
  json: unknown,
  width: number,
  height: number,
  scale: number,
  background: string | null,
  png: ArrayBuffer
): Promise<void> {
  const entry: RequestLogEntry = {
    hash,
    json,
    width,
    height,
    scale,
    background,
    createdAt: new Date().toISOString(),
  };

  ctx.waitUntil(
    r2.put(metaKey(hash), JSON.stringify(entry), {
      httpMetadata: { contentType: "application/json" },
    })
  );

  ctx.waitUntil(
    r2.put(pngKey(hash), png, {
      httpMetadata: { contentType: "image/png" },
    })
  );
}

export async function listRequestLogs(
  r2: R2Bucket,
  cursor?: string,
  limit = 50
): Promise<{ entries: RequestLogEntry[]; cursor: string | undefined }> {
  const listed = await r2.list({
    prefix: LOG_PREFIX,
    cursor,
    limit,
    include: ["httpMetadata"],
    delimiter: "/",
  });

  const prefixes = listed.delimitedPrefixes ?? [];
  const entries: RequestLogEntry[] = [];

  for (const prefix of prefixes) {
    const key = `${prefix}meta.json`;
    const obj = await r2.get(key);
    if (obj) {
      const entry = (await obj.json()) as RequestLogEntry;
      entries.push(entry);
    }
  }

  entries.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return {
    entries,
    cursor: listed.truncated ? listed.cursor : undefined,
  };
}

export async function getRequestMeta(
  r2: R2Bucket,
  hash: string
): Promise<RequestLogEntry | null> {
  const obj = await r2.get(metaKey(hash));
  if (!obj) return null;
  return (await obj.json()) as RequestLogEntry;
}

export async function getRequestScreenshot(
  r2: R2Bucket,
  hash: string
): Promise<ArrayBuffer | null> {
  const obj = await r2.get(pngKey(hash));
  if (!obj) return null;
  return obj.arrayBuffer();
}
