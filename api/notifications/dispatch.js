import { dispatchPushNotifications } from '../../src/lib/push-dispatch-runtime.mjs';
import { crmPushBackend } from '../../src/lib/crm-push-public-config.mjs';

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
    const payload = typeof request.body === 'string' ? request.body : JSON.stringify(request.body ?? {});
    const result = await dispatchPushNotifications(new Request('https://ajuda-pr-cion.vercel.app/api/notifications/dispatch', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload,
    }), crmPushBackend);
    response.statusCode = result.status;
    result.headers.forEach((value, key) => response.setHeader(key, value));
    response.end(await result.text());
  } catch {
    response.statusCode = 503;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ error: 'Push queue unavailable' }));
  }
}
