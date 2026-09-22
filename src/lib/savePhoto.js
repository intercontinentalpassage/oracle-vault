// Saves a generated PNG (from html-to-image's toPng) to the user's device.
//
// On iOS Safari, the standard `<a download>` trick doesn't work — iOS ignores
// the download attribute and just opens the image in a new tab, leaving the
// customer to manually long-press -> "Add to Photos". Instead, when the
// Web Share API with files is available (iOS Safari, most modern mobile
// browsers), we hand the image to the native share sheet, where "Save Image"
// drops it straight into the Photos gallery.
//
// Desktop browsers and any browser without file-sharing support fall back to
// the classic download-link approach, which already works fine there.

async function dataUrlToFile(dataUrl, filename) {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || "image/png" });
}

function downloadViaLink(dataUrl, filename) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

// title/text are used as the share sheet's caption on platforms that show one.
export async function savePhoto(dataUrl, filename, { title, text } = {}) {
  if (navigator.canShare) {
    try {
      const file = await dataUrlToFile(dataUrl, filename);
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title, text });
        return;
      }
    } catch (e) {
      // AbortError = the user cancelled the share sheet themselves — not a failure.
      if (e && e.name === "AbortError") return;
      // Any other share failure (including canShare returning false, or a
      // browser that throws instead of rejecting cleanly) falls through to
      // the download link below.
    }
  }
  downloadViaLink(dataUrl, filename);
}
