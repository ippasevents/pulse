'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
let swRegistered = false;
const promptSubscribers = new Set<() => void>();

function notifyPromptSubscribers() {
  promptSubscribers.forEach((cb) => cb());
}

export function checkIsStandaloneApp(): boolean {
  if (typeof window === 'undefined') return false;
  const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
  const isFullscreenMedia = window.matchMedia('(display-mode: fullscreen)').matches;
  const isMinimalUi = window.matchMedia('(display-mode: minimal-ui)').matches;
  const isNavigatorStandalone =
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  const isModeParam = window.location.search.includes('mode=standalone');
  const isAndroidApp =
    typeof document !== 'undefined' && document.referrer.includes('android-app://');

  return (
    isStandaloneMedia ||
    isFullscreenMedia ||
    isMinimalUi ||
    isNavigatorStandalone ||
    isModeParam ||
    isAndroidApp
  );
}

if (typeof window !== 'undefined') {
  // Capture beforeinstallprompt immediately at bundle load so early browser events are never missed
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    if (checkIsStandaloneApp()) return;
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    notifyPromptSubscribers();
  });

  window.addEventListener('appinstalled', () => {
    globalDeferredPrompt = null;
    notifyPromptSubscribers();
  });

  // Register network-only service worker to unlock native Chrome/Android 1-tap PWA installation
  if ('serviceWorker' in navigator && !swRegistered) {
    swRegistered = true;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // Ignore SW registration restrictions in sandboxed iframes
      });
    });
    if (document.readyState === 'complete') {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    }
  }
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    globalDeferredPrompt
  );
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Clear stale localStorage lock so browser users always see the Install App option
    try {
      localStorage.removeItem('ippas_pwa_installed');
      localStorage.removeItem('ippas_pwa_banner_dismissed');
    } catch {
      // ignore
    }

    const syncState = () => {
      const standalone = checkIsStandaloneApp();
      setIsInstalled(standalone);
      setDeferredPrompt(standalone ? null : globalDeferredPrompt);
    };

    syncState();

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice =
      /iphone|ipad|ipod/.test(userAgent) ||
      (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
    setIsIOS(isIOSDevice);

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
      } else {
        syncState();
      }
    };
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleMediaChange);
    }

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    promptSubscribers.add(syncState);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      promptSubscribers.delete(syncState);
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleMediaChange);
      }
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    const activePrompt = globalDeferredPrompt || deferredPrompt;
    if (!activePrompt) return false;
    try {
      await activePrompt.prompt();
      const { outcome } = await activePrompt.userChoice;
      if (outcome === 'accepted') {
        globalDeferredPrompt = null;
        setDeferredPrompt(null);
        setIsInstalled(true);
        notifyPromptSubscribers();
        return true;
      }
    } catch {
      return false;
    }
    return false;
  };

  return {
    isInstallable: Boolean(globalDeferredPrompt || deferredPrompt) && !isInstalled,
    isInstalled,
    isIOS,
    install
  };
}
