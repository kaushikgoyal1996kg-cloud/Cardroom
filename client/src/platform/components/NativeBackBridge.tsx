import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

/**
 * Routes Android's native Back gesture through the SAME browser-history
 * timeline used by useBackGuard. That means Lobby/Table confirmation logic
 * remains the single source of truth instead of growing a second native
 * navigation stack. At the true root there is no web history to consume, so
 * Back exits normally.
 */
export function NativeBackBridge() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let disposed = false;
    const listener = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) window.history.back();
      else void CapacitorApp.exitApp();
    });

    return () => {
      disposed = true;
      void listener.then((handle) => {
        if (disposed) void handle.remove();
      });
    };
  }, []);

  return null;
}
