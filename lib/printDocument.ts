'use client';

export interface PrintDocumentOptions {
  title?: string;
  orientation?: 'portrait' | 'landscape';
}

function absolutizeAssetUrls(root: HTMLElement) {
  if (typeof window === 'undefined') return;
  const origin = window.location.origin;

  root.querySelectorAll('img').forEach((img) => {
    const rawSrc = img.getAttribute('src');
    if (rawSrc && rawSrc.startsWith('/')) {
      img.setAttribute('src', `${origin}${rawSrc}`);
    }
  });

  root.querySelectorAll('a').forEach((a) => {
    const rawHref = a.getAttribute('href');
    if (rawHref && rawHref.startsWith('/')) {
      a.setAttribute('href', `${origin}${rawHref}`);
    }
  });
}

function collectHeadStyles(): string {
  if (typeof document === 'undefined') return '';
  const origin = window.location.origin;
  const chunks: string[] = [];

  document.head.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
    if (node.tagName.toLowerCase() === 'link') {
      const href = (node as HTMLLinkElement).getAttribute('href');
      if (href) {
        const absHref = href.startsWith('http')
          ? href
          : href.startsWith('/')
          ? `${origin}${href}`
          : `${origin}/${href}`;
        chunks.push(`<link rel="stylesheet" href="${absHref}" />`);
      }
    } else if (node.tagName.toLowerCase() === 'style') {
      chunks.push(`<style>${node.innerHTML}</style>`);
    }
  });

  return chunks.join('\n');
}

function buildStandalonePrintHtml(
  bodyInnerMarkup: string,
  title: string,
  orientation: 'portrait' | 'landscape'
): string {
  const headStyles = collectHeadStyles();

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${title.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</title>
    ${headStyles}
    <style>
      @page {
        size: A4 ${orientation};
        margin: 8mm;
      }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #0f172a !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .no-print {
        display: none !important;
      }
      #isolated-print-root {
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
      }
      #isolated-print-root > * {
        max-width: 100% !important;
        width: 100% !important;
        min-height: auto !important;
        max-height: none !important;
        box-shadow: none !important;
        margin: 0 !important;
        overflow: visible !important;
      }
      table {
        page-break-inside: auto;
      }
      tr {
        page-break-inside: avoid;
        page-break-after: auto;
      }
    </style>
  </head>
  <body>
    <div id="isolated-print-root">${bodyInnerMarkup}</div>
  </body>
</html>`;
}

function printViaHiddenIframe(fullHtml: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const existing = document.getElementById('ippas-isolated-print-iframe');
  if (existing && existing.parentNode) {
    existing.parentNode.removeChild(existing);
  }

  const iframe = document.createElement('iframe');
  iframe.id = 'ippas-isolated-print-iframe';
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  const cleanup = () => {
    setTimeout(() => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    }, 1500);
  };

  let hasPrinted = false;
  const executePrint = () => {
    if (hasPrinted) return;
    hasPrinted = true;
    try {
      const win = iframe.contentWindow;
      if (win) {
        win.focus();
        win.print();
      }
    } catch (err) {
      console.error('Isolated print error:', err);
    } finally {
      cleanup();
    }
  };

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    cleanup();
    return;
  }

  doc.open();
  doc.write(fullHtml);
  doc.close();

  const waitForResourcesAndPrint = () => {
    const win = iframe.contentWindow;
    const iframeDoc = iframe.contentDocument || win?.document;
    if (!iframeDoc) {
      executePrint();
      return;
    }

    const images = Array.from(iframeDoc.querySelectorAll('img'));
    const links = Array.from(iframeDoc.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];

    const pendingPromises: Promise<void>[] = [];

    images.forEach((img) => {
      if (!img.complete) {
        pendingPromises.push(
          new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          })
        );
      }
    });

    links.forEach((lnk) => {
      if (!lnk.sheet) {
        pendingPromises.push(
          new Promise<void>((resolve) => {
            lnk.onload = () => resolve();
            lnk.onerror = () => resolve();
          })
        );
      }
    });

    if (pendingPromises.length === 0) {
      setTimeout(executePrint, 120);
      return;
    }

    const safetyTimeout = new Promise<void>((resolve) => setTimeout(resolve, 900));
    Promise.race([Promise.all(pendingPromises).then(() => undefined), safetyTimeout]).then(() => {
      setTimeout(executePrint, 80);
    });
  };

  if (doc.readyState === 'complete') {
    waitForResourcesAndPrint();
  } else {
    iframe.onload = waitForResourcesAndPrint;
    setTimeout(waitForResourcesAndPrint, 450);
  }
}

/**
 * Prints ONLY the specified DOM element inside an isolated hidden iframe,
 * completely excluding surrounding web page UI, navigation bars, tables, and modals.
 */
export function printElementById(
  elementId: string,
  options?: PrintDocumentOptions | string
): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;

  const target = document.getElementById(elementId);
  if (!target) {
    console.warn(`printElementById: Element #${elementId} not found.`);
    return false;
  }

  const normalizedOpts: PrintDocumentOptions =
    typeof options === 'string' ? { title: options } : options || {};
  const title = normalizedOpts.title || document.title || 'Document';
  const orientation = normalizedOpts.orientation || 'portrait';

  const clone = target.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.no-print, button.no-print').forEach((el) => el.remove());
  absolutizeAssetUrls(clone);

  clone.style.maxWidth = '100%';
  clone.style.width = '100%';
  clone.style.minHeight = 'auto';
  clone.style.boxShadow = 'none';
  clone.style.margin = '0';

  const fullHtml = buildStandalonePrintHtml(clone.outerHTML, title, orientation);
  printViaHiddenIframe(fullHtml);
  return true;
}

/**
 * Prints standalone HTML markup directly inside an isolated hidden iframe
 * without requiring the document to be mounted on the visible page.
 */
export function printHtmlDocument(
  htmlMarkup: string,
  options?: PrintDocumentOptions | string
): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;

  const normalizedOpts: PrintDocumentOptions =
    typeof options === 'string' ? { title: options } : options || {};
  const title = normalizedOpts.title || document.title || 'Document';
  const orientation = normalizedOpts.orientation || 'portrait';

  const wrapper = document.createElement('div');
  wrapper.innerHTML = htmlMarkup;
  absolutizeAssetUrls(wrapper);

  const fullHtml = buildStandalonePrintHtml(wrapper.innerHTML, title, orientation);
  printViaHiddenIframe(fullHtml);
  return true;
}
