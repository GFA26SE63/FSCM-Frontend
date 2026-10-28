import {
  PublicClientApplication,
  type AuthenticationResult,
} from '@azure/msal-browser';
import { ApiError } from '../api/errors';
import { env } from '../lib/env';

const isGuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  ) && value !== '00000000-0000-0000-0000-000000000000';

export const externalAuthConfig = {
  microsoftConfigured:
    isGuid(env.entra.tenantId) &&
    isGuid(env.entra.clientId),
};

let clientPromise: Promise<PublicClientApplication> | null = null;

async function getMicrosoftClient(): Promise<PublicClientApplication> {
  if (!externalAuthConfig.microsoftConfigured) {
    throw new ApiError(
      400,
      'Chưa cấu hình Microsoft Entra ID',
      'Kiểm tra tenant ID và client ID của ứng dụng.',
    );
  }

  if (!clientPromise) {
    clientPromise = (async () => {
      const client = new PublicClientApplication({
        auth: {
          clientId: env.entra.clientId,
          authority:
            `https://login.microsoftonline.com/${env.entra.tenantId}`,
          redirectUri: env.entra.redirectUri,
        },
        cache: {
          cacheLocation: 'sessionStorage',
        },
      });

      await client.initialize();
      return client;
    })().catch((error: unknown) => {
      clientPromise = null;
      throw error;
    });
  }

  return clientPromise;
}

function getIdToken(result: AuthenticationResult): string {
  if (!result.idToken) {
    throw new ApiError(
      401,
      'Không nhận được token Microsoft',
      'Hãy thử đăng nhập lại.',
    );
  }

  return result.idToken;
}

export async function acquireMicrosoftIdToken(): Promise<string> {
  try {
    const client = await getMicrosoftClient();

    const result = await client.loginPopup({
      scopes: ['openid', 'profile', 'email'],
      prompt: 'select_account',
    });

    client.setActiveAccount(result.account);

    return getIdToken(result);
  } catch (error) {
    if (error instanceof ApiError) throw error;

    const code =
      typeof error === 'object' &&
      error !== null &&
      'errorCode' in error
        ? String(error.errorCode)
        : '';

    if (code === 'user_cancelled') {
      throw new ApiError(
        400,
        'Đã hủy đăng nhập Microsoft',
      );
    }

    if (code === 'interaction_in_progress') {
      throw new ApiError(
        400,
        'Đang có yêu cầu đăng nhập',
        'Hoàn tất cửa sổ Microsoft đang mở trước.',
      );
    }

    if (
      code === 'popup_window_error' ||
      code === 'empty_window_error'
    ) {
      throw new ApiError(
        400,
        'Không mở được cửa sổ đăng nhập',
        'Cho phép popup trên trình duyệt rồi thử lại.',
      );
    }

    throw new ApiError(
      400,
      'Đăng nhập Microsoft thất bại',
      'Kiểm tra kết nối và cấu hình Microsoft Entra.',
    );
  }
}