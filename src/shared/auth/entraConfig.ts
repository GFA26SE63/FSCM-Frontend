import { env } from '../lib/env';

/**
 * Microsoft Entra ID configuration (placeholders). When the real API is used, add @azure/msal-browser and
 * create a PublicClientApplication with this config; acquireTokenSilent({ scopes: [apiScope] }) gives the
 * Bearer token that tokenStore keeps. Mock mode never calls Entra.
 */
export const entraConfig = {
  auth: {
    clientId: env.entra.clientId,
    authority: `https://login.microsoftonline.com/${env.entra.tenantId || 'common'}`,
    redirectUri: env.entra.redirectUri,
  },
  scopes: [env.entra.apiScope],
  isConfigured: !!env.entra.clientId && !/^0{8}-/.test(env.entra.clientId),
};
