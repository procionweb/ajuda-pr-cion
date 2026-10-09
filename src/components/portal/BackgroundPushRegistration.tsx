import { useEffect } from 'react';
import { usePortalAuth } from '@/lib/portal-auth';
import { refreshBackgroundPush } from '@/lib/background-push';

export function BackgroundPushRegistration() {
  const { session } = usePortalAuth();
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return;
    const refresh = () => { void refreshBackgroundPush(userId).catch(() => {}); };
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [userId]);
  return null;
}
