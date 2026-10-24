import type { APIRoute } from 'astro';

/**
 * Relais vers les API d'IA utilisées par l'éditeur.
 *
 * Le navigateur ne peut pas appeler ces services directement (CORS). Ce relais
 * reste fermé : liste blanche d'hôtes HTTPS, en-têtes filtrés, corps borné.
 * Sans la liste blanche, n'importe qui pourrait faire appeler une adresse
 * interne par le serveur (SSRF).
 */
export const prerender = false;

const ALLOWED_HOSTS = new Set([
  'api.openai.com',
  'api.anthropic.com',
  'generativelanguage.googleapis.com',
  'api.x.ai',
  'api.mistral.ai',
  'api.cohere.com',
]);

const FORWARDED_HEADERS = new Set(['content-type', 'accept', 'anthropic-version']);

const MAX_BODY_BYTES = 256 * 1024;

const envKey = (host: string): string | undefined => {
  switch (host) {
    case 'api.openai.com':
      return import.meta.env.OPENAI_API_KEY;
    case 'api.anthropic.com':
      return import.meta.env.ANTHROPIC_API_KEY;
    case 'generativelanguage.googleapis.com':
      return import.meta.env.GEMINI_API_KEY;
    case 'api.x.ai':
      return import.meta.env.XAI_API_KEY;
    case 'api.mistral.ai':
      return import.meta.env.MISTRAL_API_KEY;
    case 'api.cohere.com':
      return import.meta.env.COHERE_API_KEY;
    default:
      return undefined;
  }
};

const authHeaders = (host: string, key: string): Record<string, string> => {
  if (host === 'api.anthropic.com') {
    return { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' };
  }
  if (host === 'generativelanguage.googleapis.com') return { 'x-goog-api-key': key };
  return { Authorization: `Bearer ${key}` };
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

export const POST: APIRoute = async ({ request }) => {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: 'Requête trop volumineuse.' }, 413);

  let payload: { url?: unknown; body?: unknown; headers?: unknown };
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ error: 'JSON invalide.' }, 400);
  }

  let target: URL;
  try {
    target = new URL(String(payload.url ?? ''));
  } catch {
    return json({ error: 'URL invalide.' }, 400);
  }

  if (target.protocol !== 'https:' || !ALLOWED_HOSTS.has(target.host)) {
    return json({ error: 'Hôte non autorisé.' }, 403);
  }

  const key = request.headers.get('x-provider-key') || envKey(target.host);
  if (!key) return json({ error: 'Clé API absente.' }, 401);

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (payload.headers && typeof payload.headers === 'object') {
    for (const [name, value] of Object.entries(payload.headers as Record<string, unknown>)) {
      if (!FORWARDED_HEADERS.has(name.toLowerCase()) || typeof value !== 'string') continue;
      if (/[\r\n]/.test(value)) continue;
      headers[name] = value;
    }
  }
  Object.assign(headers, authHeaders(target.host, key));

  const body = typeof payload.body === 'string' ? payload.body : JSON.stringify(payload.body ?? {});

  try {
    const upstream = await fetch(target, { method: 'POST', headers, body });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return json({ error: `Relais : ${(error as Error).message}` }, 502);
  }
};
