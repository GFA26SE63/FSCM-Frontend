import { useEffect, useRef } from 'react';

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleIdentityApi {
  initialize: (options: { client_id: string; callback: (response: GoogleCredentialResponse) => void }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, string | number>) => void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentityApi } };
  }
}

let googleScript: Promise<void> | null = null;

function loadGoogleIdentity() {
  googleScript ??= new Promise<void>((resolve, reject) => {
    if (window.google) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>('script[data-fscm-google-identity]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Không thể tải Google Identity Services.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.fscmGoogleIdentity = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Không thể tải Google Identity Services.'));
    document.head.appendChild(script);
  });
  return googleScript;
}

export function GoogleSignInButton({
  clientId,
  disabled,
  onCredential,
  onError,
}: {
  clientId: string;
  disabled?: boolean;
  onCredential: (credential: string) => void;
  onError: (error: unknown) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const credentialHandler = useRef(onCredential);

  useEffect(() => {
    credentialHandler.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    let active = true;
    void loadGoogleIdentity()
      .then(() => {
        if (!active || !host.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => credentialHandler.current(response.credential),
        });
        host.current.replaceChildren();
        window.google.accounts.id.renderButton(host.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          width: 368,
          locale: 'vi',
        });
      })
      .catch(onError);
    return () => {
      active = false;
    };
  }, [clientId, onError]);

  return <div className="google-signin" ref={host} aria-disabled={disabled} style={disabled ? { pointerEvents: 'none', opacity: 0.6 } : undefined} />;
}
