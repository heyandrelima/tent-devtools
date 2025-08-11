import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import SetupWindow from './windows/Setup';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SetupWindow />
  </StrictMode>
);


