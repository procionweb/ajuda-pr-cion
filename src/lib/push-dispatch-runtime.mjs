import webpush from 'web-push';
export function isBrowserPushEndpoint(endpoint) {
    try {
        const url = new URL(endpoint);
        return url.protocol === 'https:' && !url.username && !url.password && (!url.port || url.port === '443') &&
            (['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'].includes(url.hostname) ||
                /^[a-z0-9.-]+\.notify\.windows\.com$/.test(url.hostname));
    }
    catch {
        return false;
    }
}
async function rpc(config, name, args) {
    const response = await fetch(`${config.supabaseUrl}/rest/v1/rpc/${name}`, {
        method: 'POST', headers: { apikey: config.supabasePublishableKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(args), signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok)
        throw new Error(response.status === 401 || response.status === 403 ? 'Unauthorized' : 'Push queue unavailable');
    const body = await response.text();
    return body ? JSON.parse(body) : null;
}
export async function dispatchPushNotifications(request, config) {
    const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
    let token;
    try {
        const body = await request.json();
        if (typeof body.token !== 'string' || !/^[a-f0-9]{64}$/.test(body.token))
            return json({ error: 'Unauthorized' }, 403);
        token = body.token;
    }
    catch {
        return json({ error: 'Invalid request' }, 400);
    }
    try {
        // Only the private scheduler token can lease messages or access the VAPID private key.
        const batch = await rpc(config, 'claim_crm_push_deliveries', { p_token: token });
        let sent = 0;
        await Promise.all(batch.jobs.map(async (job) => {
            let status = 500;
            try {
                if (!isBrowserPushEndpoint(job.subscription.endpoint)) {
                    status = 410;
                }
                else {
                    const details = webpush.generateRequestDetails(job.subscription, JSON.stringify(job.payload), {
                        TTL: 86400, urgency: 'normal',
                        vapidDetails: { subject: 'https://ajuda-pr-cion.vercel.app', publicKey: batch.publicKey, privateKey: batch.privateKey },
                    });
                    const response = await fetch(details.endpoint, {
                        method: details.method, headers: details.headers,
                        body: details.body,
                        redirect: 'error', signal: AbortSignal.timeout(10_000),
                    });
                    status = response.status;
                    if (response.ok)
                        sent++;
                }
            }
            catch {
                // Retry from the queue; payloads, keys and subscription URLs never enter logs.
            }
            await rpc(config, 'finish_crm_push_delivery', {
                p_token: token, p_id: job.id, p_lease_id: job.leaseId, p_status: status,
            });
        }));
        return json({ processed: batch.jobs.length, sent });
    }
    catch (error) {
        return json({ error: error instanceof Error && error.message === 'Unauthorized' ? 'Unauthorized' : 'Push queue unavailable' }, error instanceof Error && error.message === 'Unauthorized' ? 403 : 503);
    }
}
