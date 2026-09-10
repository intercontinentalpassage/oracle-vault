// Resizes an image down to a reasonable max dimension and re-encodes it
// as WebP (falling back to JPEG on browsers that can't encode WebP via
// canvas) before upload, so a huge photo straight off a phone camera
// (often 8-15MB) doesn't end up as the literal file every visitor has to
// download. Runs entirely in the browser — no server round-trip needed
// just to shrink an image.

let webpSupportCache = null;
function supportsWebpEncoding() {
  if (webpSupportCache !== null) return webpSupportCache;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  webpSupportCache = canvas.toDataURL("image/webp").startsWith("data:image/webp");
  return webpSupportCache;
}

export function compressImage(file, { maxDimension = 1600, quality = 0.82, format } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width >= height) {
          height = Math.round((height / width) * maxDimension);
          width = maxDimension;
        } else {
          width = Math.round((width / height) * maxDimension);
          height = maxDimension;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      const outputFormat = format || (supportsWebpEncoding() ? "image/webp" : "image/jpeg");

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Couldn't process that image."));
            return;
          }
          resolve({ blob, format: outputFormat });
        },
        outputFormat,
        outputFormat === "image/png" ? undefined : quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Couldn't read that image file."));
    };

    img.src = objectUrl;
  });
}
