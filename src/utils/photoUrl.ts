/**
 * Photo URL resolution and resilient fallback handler for SIPADES Sirombu
 * Ensures physical photos stored in cPanel uploads/ always display cleanly without breaking or flickering.
 */

export function getPhotoUrl(path?: string | null): string {
  if (!path || typeof path !== 'string') return '';
  const trimmed = path.trim();
  if (!trimmed) return '';

  // Base64 data URI, Blob, or Absolute URL
  if (
    trimmed.startsWith('data:image') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://')
  ) {
    return trimmed;
  }

  // Relative path starting with /uploads/
  if (trimmed.startsWith('/uploads/')) {
    return trimmed;
  }

  // Path starting with uploads/
  if (trimmed.startsWith('uploads/')) {
    return '/' + trimmed;
  }

  return trimmed;
}

/**
 * Image error handler with cPanel remote fallback and automatic delayed retry
 * Recovers cleanly when Cloudflare/origin hosting has a brief cold-cache timeout.
 */
export function handlePhotoError(e: React.SyntheticEvent<HTMLImageElement, Event>) {
  const target = e.currentTarget;
  const attempts = Number(target.dataset.retryAttempts || '0');
  if (attempts >= 2) {
    return;
  }
  target.dataset.retryAttempts = String(attempts + 1);

  const currentSrc = target.src || '';
  if (!currentSrc.includes('/uploads/')) {
    return;
  }

  const uploadIndex = currentSrc.indexOf('/uploads/');
  const relativePath = currentSrc.substring(uploadIndex).split('?')[0];

  if (attempts === 0 && !currentSrc.startsWith('https://sipadessirombu.my.id/')) {
    // First fallback: try direct cPanel/Cloudflare URL
    setTimeout(() => {
      if (target.isConnected) {
        target.src = `https://sipadessirombu.my.id${relativePath}`;
      }
    }, 600);
    return;
  }

  // Second retry: wait briefly for Cloudflare/origin to finish warming up and retry once
  setTimeout(() => {
    if (target.isConnected) {
      target.src = `https://sipadessirombu.my.id${relativePath}?_r=${attempts + 1}`;
    }
  }, 2500);
}
