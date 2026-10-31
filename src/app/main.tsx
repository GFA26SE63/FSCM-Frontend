import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { env } from '@/shared/lib/env';
import '@/shared/ui/styles.css';
import './layout/layout.css';
import { App } from './App';

function bootstrap() {
  const app = <App />;
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      {env.google.clientId ? (
        <GoogleOAuthProvider clientId={env.google.clientId} locale="vi">
          {app}
        </GoogleOAuthProvider>
      ) : app}
    </StrictMode>,
  );
}

bootstrap();
