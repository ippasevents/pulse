'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect standalone mode (already installed or running inside standalone PWA)
    const checkStandalone = (): boolean => {
      const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
      const isFullscreenMedia = window.matchMedia('(display-mode: fullscreen)').matches;
      const isMinimalUi = window.matchMedia('(display-mode: minimal-ui)').matches;
      const isNavigatorStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      const isModeParam = window.location.search.includes('mode=standalone');
      const isAndroidApp = typeof document !== 'undefined' && document.referrer.includes('android-app://');
      const isStoredInstalled = localStorage.getItem('ippas_pwa_installed') === 'true';

      return (
        isStandaloneMedia ||
        isFullscreenMedia ||
        isMinimalUi ||
        isNavigatorStandalone ||
        isModeParam ||
        isAndroidApp ||
        isStoredInstalled
      );
    };

    const standaloneActive = checkStandalone();
    setIsInstalled(standaloneActive);
    if (standaloneActive) {
      localStorage.setItem('ippas_pwa_installed', 'true');
    }

    // Media query change listener
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
        localStorage.setItem('ippas_pwa_installed', 'true');
      }
    };
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleMediaChange);
    }

    // Detect iOS devices
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      // If already installed, never show install prompts
      if (checkStandalone()) return;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      localStorage.setItem('ippas_pwa_installed', 'true');
      localStorage.setItem('ippas_pwa_banner_dismissed', 'true');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleMediaChange);
      }
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      localStorage.setItem('ippas_pwa_installed', 'true');
      localStorage.setItem('ippas_pwa_banner_dismissed', 'true');
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt && !isInstalled,
    isInstalled,
    isIOS,
    install,
  };
}
