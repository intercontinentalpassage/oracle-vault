// Saving a generated photo (order summary, available numbers) to the device.
//
// A website can't write straight into the phone's gallery, so each platform
// gets the route that ends up there with the fewest steps:
//
//   iPhone / iPad  Native share sheet, where "Save Image" puts it in Photos.
//                  (iOS ignores <a download> for images and Files is where a
//                  plain download lands, so the share sheet is the only way
//                  into Photos.)
//   Android        Direct download. Gallery apps (Google Photos, Samsung
//                  Gallery) show downloaded images in their "Download" album.
//   Desktop        Direct download.
//
// The share sheet only opens within a few seconds of a tap. Drawing the photo
// can take longer than that on slow internet (fonts and the logo are fetched),
// which used to make the share sheet fail and fall back to a download into
// Files. So photos are now prepared in advance (see usePreparedPhoto), and if
// the share sheet is still refused we ask for one more tap instead of quietly
// downloading.

export function isIOS() {
  const ua = navigator.userAgent || "";
  // iPadOS reports itself as a Mac, but Macs don't have touch screens.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export async function dataUrlToFile(dataUrl, filename) {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || "image/png" });
}

function downloadFile(file) {
  // A blob URL instead of a long data: URL — large images in a data: href can
  // fail to download on some Android browsers.
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.download = file.name;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// Returns "saved", "cancelled" (the user closed the share sheet) or
// "needs-tap" (the browser refused the share sheet because too much time
// passed since the tap; call again from a fresh tap).
// title/text are used as the share sheet's caption on platforms that show one.
export async function saveFile(file, { title, text } = {}) {
  if (isIOS() && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text });
      return "saved";
    } catch (e) {
      if (e && e.name === "AbortError") return "cancelled";
      if (e && e.name === "NotAllowedError") return "needs-tap";
      // Anything else: fall through to a normal download rather than nothing.
    }
  }
  downloadFile(file);
  return "saved";
}
