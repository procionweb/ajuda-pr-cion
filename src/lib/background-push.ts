import { supabase } from '@/lib/supabase';
const ENABLED_KEY = 'procion.background-push.user';

async function pushRpc(name: string, args: Record<string, unknown> = {}) {
  const { data, error } = await supabase.rpc(name as never, args as never);
  if (error) throw new Error('Não foi possível ativar o envio de notificações. Tente novamente.');
  return data as unknown;
}

export function hasBackgroundPush(userId?: string) {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return false;
  const enrolled = localStorage.getItem(ENABLED_KEY);
  return Boolean(enrolled && (!userId || enrolled === userId));
}

function supportsPush() {
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

async function registerDevice(userId: string) {
  const publicKey = await pushRpc('get_crm_push_public_key');
  if (typeof publicKey !== 'string' || !publicKey) throw new Error('O serviço de notificações ainda não está disponível.');
  await navigator.serviceWorker.register('/notification-sw.js');
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    const base64 = publicKey.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64 + '='.repeat((4 - base64.length % 4) % 4)), (char) => char.charCodeAt(0));
    subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
  }
  await pushRpc('register_crm_push_subscription', { p_subscription: subscription.toJSON() });
  localStorage.setItem(ENABLED_KEY, userId);
}

export async function enableBackgroundPush() {
  if (!supportsPush()) throw new Error('Para receber avisos no iPhone/iPad, adicione o CRM à Tela de Início e abra por esse ícone. Em outros dispositivos, use um navegador com suporte a notificações push.');
  // Permission must be requested directly from the user's click, especially on iOS.
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permita as notificações do CRM nas configurações deste navegador.');
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('Entre no CRM para ativar as notificações.');
  await registerDevice(data.session.user.id);
  await pushRpc('test_crm_push_notification');
}

export async function refreshBackgroundPush(userId: string) {
  if (supportsPush() && Notification.permission === 'granted' && localStorage.getItem(ENABLED_KEY)) {
    await registerDevice(userId);
  }
}

export async function disconnectBackgroundPush() {
  localStorage.removeItem(ENABLED_KEY);
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration('/notification-sw.js');
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  try { await pushRpc('unregister_crm_push_subscription', { p_endpoint: subscription.endpoint }); }
  finally { await subscription.unsubscribe(); }
}
