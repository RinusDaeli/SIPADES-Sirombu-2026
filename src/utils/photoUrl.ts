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
 * Image error handler that attempts cPanel remote hosting fallback if local relative path fails
 */
export function handlePhotoError(e: React.SyntheticEvent<HTMLImageElement, Event>) {
  const target = e.currentTarget;
  if (target.dataset.hasFailedFallback) {
    // Already tried fallback, prevent infinite loop
    return;
  }
  target.dataset.hasFailedFallback = 'true';

  const currentSrc = target.src || '';
  if (currentSrc.includes('/uploads/')) {
    const uploadIndex = currentSrc.indexOf('/uploads/');
    const relativePath = currentSrc.substring(uploadIndex);
    target.src = `https://sipadessirombu.my.id${relativePath}`;
  }
}
