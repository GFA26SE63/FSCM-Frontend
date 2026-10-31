import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/shared/ui/styles.css';
import './layout/layout.css';
import { App } from './App';

function bootstrap() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

bootstrap();
