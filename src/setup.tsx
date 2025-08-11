import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { ThemeProvider } from './contexts/ThemeContext';
import SetupWindow from './windows/Setup';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <SetupWindow />
    </ThemeProvider>
  </StrictMode>
);


