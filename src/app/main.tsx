import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { http } from '@/shared/api/http';
import { env } from '@/shared/lib/env';
import '@/shared/ui/styles.css';
import './layout/layout.css';
import { App } from './App';

async function bootstrap() {
  // Mock mode: swap axios' adapter for the in-browser API (prototype seed data + allocation / rotation engines).
  if (env.useMock) {
    const { installMock } = await import('@/shared/api/mock');
    installMock(http);
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
