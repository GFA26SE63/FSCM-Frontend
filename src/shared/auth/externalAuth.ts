import type { PublicClientApplication } from '@azure/msal-browser';
import { ApiError } from '../api/errors';
import { env } from '../lib/env';

const configured = (value: string) => !!value && !/^0{8,}/.test(value) && !value.includes('example');

export const externalAuthConfig = {
  microsoftConfigured: configured(env.entra.clientId),
  googleConfigured: configured(env.google.clientId),
};

let microsoftClient: Promise<PublicClientApplication> | null = null;

async function getMicrosoftClient() {
  if (!externalAuthConfig.microsoftConfigured) {
    throw new ApiError(400, 'Chưa cấu hình Microsoft Entra ID', 'Điền VITE_ENTRA_TENANT_ID và VITE_ENTRA_CLIENT_ID trong .env.');
  }
  microsoftClient ??= (async () => {
    const { PublicClientApplication } = await import('@azure/msal-browser');
    const client = new PublicClientApplication({
      auth: {
        clientId: env.entra.clientId,
        authority: `https://login.microsoftonline.com/${env.entra.tenantId || 'common'}`,
        redirectUri: env.entra.redirectUri,
      },
      cache: { cacheLocation: 'sessionStorage' },
    });
    await client.initialize();
    return client;
  })();
  return microsoftClient;
}

/** Authenticate identity only. The returned Entra ID token must be exchanged for an FSCM JWT. */
export async function acquireMicrosoftIdToken() {
  const client = await getMicrosoftClient();
  const result = await client.loginPopup({ scopes: ['openid', 'profile', 'email'], prompt: 'select_account' });
  if (!result.idToken) throw new ApiError(401, 'Microsoft không trả về ID token');
  return result.idToken;
}
