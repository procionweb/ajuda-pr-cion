export const maxDuration = 30;

// Native Node handler works with both static CRM deployments and SSR projects.
export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.statusCode = 405;
    response.end();
    return;
  }
  try {
    const parsed = typeof request.body === 'string' ? JSON.parse(request.body) : (request.body ?? {});
    if (typeof parsed.token !== 'string' || !/^[a-f0-9]{64}$/.test(parsed.token)) {
      response.statusCode = 403;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
    const { dispatchPushNotifications } = await import('../../src/lib/push-dispatch-runtime.mjs');
    const { crmPushBackend } = await import('../../src/lib/crm-push-public-config.mjs');
    const payload = JSON.stringify(parsed);
    const result = await dispatchPushNotifications(new Request('https://ajuda-pr-cion.vercel.app/api/notifications/dispatch', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload,
    }), crmPushBackend);
    response.statusCode = result.status;
    result.headers.forEach((value, key) => response.setHeader(key, value));
    response.end(await result.text());
  } catch (error) {
    response.statusCode = 503;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ error: 'Push runtime unavailable', code: typeof error?.code === 'string' ? error.code : 'RUNTIME_ERROR' }));
  }
}
