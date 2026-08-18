import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { GameProvider } from './lib/GameStore';
import { StartupErrorBoundary } from './platform/components/StartupErrorBoundary';
import { NativeBackBridge } from './platform/components/NativeBackBridge';
import './styles/global.css';
import { initializeTablePreferences } from './lib/tablePreferences';

initializeTablePreferences();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Wraps GameProvider, because the throw we most need to catch happens
        inside GameStore's own initialisation - a boundary inside it would
        never see it. */}
    <StartupErrorBoundary>
      <NativeBackBridge />
      <GameProvider>
        <App />
      </GameProvider>
    </StartupErrorBoundary>
  </React.StrictMode>
);
