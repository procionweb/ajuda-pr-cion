export function isBrowserPushEndpoint(endpoint: string): boolean;
export function dispatchPushNotifications(request: Request, config: { supabaseUrl: string; supabasePublishableKey: string }): Promise<Response>;
