import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function PwaManifest() {
  const { pathname } = useLocation();
  const isNumPlateApp = pathname === '/numplateapp' || pathname.startsWith('/numplateapp/');

  useLayoutEffect(() => {
    if (!isNumPlateApp) return;
    const manifest = document.querySelector('link[rel="manifest"]');
    if (!manifest) return;
    const originalHref = manifest.href;
    const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    const originalTitle = appleTitle?.content;
    manifest.href = new URL('numplateapp-manifest.json', originalHref).href;
    if (appleTitle) appleTitle.content = 'DACOS 번호판';
    return () => {
      manifest.href = originalHref;
      if (appleTitle) appleTitle.content = originalTitle;
    };
  }, [isNumPlateApp]);

  return null;
}
