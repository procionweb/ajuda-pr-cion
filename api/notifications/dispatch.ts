import { dispatchPushNotifications } from '../../src/lib/push-dispatch.server';
import { crmPushBackend } from '../../src/lib/crm-push-public-config';

export const maxDuration = 30;

// Native Vercel function: also runs when the CRM is deployed as a static frontend.
export default {
  async fetch(request: Request) {
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });
    return dispatchPushNotifications(request, crmPushBackend);
  },
};
