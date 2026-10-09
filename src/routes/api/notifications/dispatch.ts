import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/notifications/dispatch')({
  server: { handlers: { POST: async ({ request }) => {
    const { dispatchPushNotifications } = await import('@/lib/push-dispatch.server');
    return dispatchPushNotifications(request);
  } } },
});
