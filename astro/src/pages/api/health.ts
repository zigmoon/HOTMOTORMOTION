import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = () => {
  return new Response(
    JSON.stringify({
      ok: true,
      app: 'HOT MOTOR MOTION',
      version: '1.0.0',
      engine: 'canvas 2d + moteur de courbes maison',
      runtime: `node ${process.version}`,
      time: new Date().toISOString(),
    }),
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    },
  );
};
