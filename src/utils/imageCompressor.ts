/**
 * Utility to compress and resize image files to crisp High-Definition (HD) JPEG data URLs
 * with high-grade bicubic smoothing to guarantee sharp visual clarity for serial numbers,
 * labels, and physical asset documentation while maintaining lightweight Firestore storage.
 */
export async function fileToCompressedDataUrl(
  file: File,
  maxWidth = 1600,
  maxHeight = 1600,
  initialQuality = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Gagal memproses gambar'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Maintain full aspect ratio up to crisp HD 1600px resolution
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        // Enable high-grade bicubic resampling for sharp text & edge details
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Clean white background for transparency safety
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Smart adaptive compression:
        // Start at 85% high quality. If base64 exceeds ~250KB, gently balance to 80% or 76%
        // while preserving the full HD resolution.
        let quality = initialQuality;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);

        if (dataUrl.length > 360000) {
          quality = 0.80;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        if (dataUrl.length > 360000) {
          quality = 0.76;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        resolve(dataUrl);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}
