import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
import webpush from 'web-push';
import { createECDH, randomBytes } from 'node:crypto';

const handlers = {};
const shown = [];
let opened;
const worker = {
  addEventListener: (name, handler) => { handlers[name] = handler; },
  registration: { showNotification: async (title, options) => { shown.push({ title, options }); } },
  location: { origin: 'https://crm.example' },
  clients: { matchAll: async () => [], openWindow: async (url) => { opened = url; } },
};
vm.runInNewContext(fs.readFileSync('public/notification-sw.js', 'utf8'), { self: worker, URL });
let waiting;
handlers.push({ data: { json: () => ({ title: 'Convite', body: 'Reunião', href: '/calendario?evento=test', tag: 'crm:test' }) }, waitUntil: p => { waiting = p; } });
await waiting;
assert.equal(shown[0].title, 'Convite');
assert.equal(shown[0].options.tag, 'crm:test');
handlers.notificationclick({ notification: { close() {}, data: shown[0].options.data }, waitUntil: p => { waiting = p; } });
await waiting;
assert.equal(opened, 'https://crm.example/calendario?evento=test');
handlers.push({ data: { json: () => ({ href: '//evil.example/path' }) }, waitUntil: p => { waiting = p; } });
await waiting;
assert.equal(shown[1].options.data.href, '/');

const keys = webpush.generateVAPIDKeys();
const ecdh = createECDH('prime256v1'); ecdh.generateKeys();
const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/test', keys: {
  p256dh: ecdh.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url'),
} };
const jobs = [
  { id: 'one', leaseId: 'lease-one', subscription, payload: { title: 'Convite', body: 'Conteúdo privado', tag: 'crm:test', href: '/calendario' } },
  { id: 'two', leaseId: 'lease-two', subscription: { ...subscription, endpoint: 'https://evil.example/internal' }, payload: { title: 'Test' } },
];
const results = [];
let sends = 0;
const fakeFetch = async (url, init) => {
  if (url.endsWith('/claim_crm_push_deliveries')) return Response.json({ publicKey: keys.publicKey, privateKey: keys.privateKey, jobs });
  if (url.endsWith('/finish_crm_push_delivery')) { results.push(JSON.parse(init.body)); return new Response(null, { status: 204 }); }
  assert.equal(url, subscription.endpoint);
  assert.equal(init.redirect, 'error');
  assert(init.headers.Authorization || init.headers.authorization);
  assert(!Buffer.from(init.body).toString().includes('Conteúdo privado'));
  sends++;
  return new Response(null, { status: 201 });
};
const source = fs.readFileSync('src/lib/push-dispatch-runtime.mjs', 'utf8');
const code = ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true });
const exported = {};
vm.runInNewContext(code, { exports: exported, require: name => name === 'web-push' ? webpush : { supabaseUrl: 'https://crm.supabase.co', supabasePublishableKey: 'public' }, URL, Response, AbortSignal, fetch: fakeFetch });
assert(!exported.isBrowserPushEndpoint('https://fcm.googleapis.com.evil.test/send'));
assert(!exported.isBrowserPushEndpoint('http://fcm.googleapis.com/send'));
assert(!exported.isBrowserPushEndpoint('https://user:pass@fcm.googleapis.com/send'));
const backendConfig = { supabaseUrl: 'https://crm.supabase.co', supabasePublishableKey: 'public' };
const bad = await exported.dispatchPushNotifications(new Request('https://crm.example/api/notifications/dispatch', { method: 'POST', body: JSON.stringify({ token: 'invalid' }) }), backendConfig);
assert.equal(bad.status, 403);
const ok = await exported.dispatchPushNotifications(new Request('https://crm.example/api/notifications/dispatch', { method: 'POST', body: JSON.stringify({ token: 'a'.repeat(64) }) }), backendConfig);
assert.equal(ok.status, 200);
assert.equal(sends, 1);
assert.equal(results.find(r => r.p_id === 'one').p_status, 201);
assert.equal(results.find(r => r.p_id === 'two').p_status, 410);
assert(!JSON.stringify(await ok.json()).includes(keys.privateKey));
console.log('Push browser/server: recebimento sem janela aberta, clique, criptografia, autorização e bloqueio de endpoints passaram. Nenhum aviso real enviado.');
