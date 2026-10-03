import { useCallback, useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { dataUrlToFile, saveFile } from "./savePhoto";

// Turns the element in cardRef into a PNG in the background as soon as it is
// on screen, and again whenever its contents change (a number sells, prices
// are hidden, the logo finishes loading...). By the time the Save button is
// tapped the photo is ready, so the iPhone share sheet opens instantly.
//
// status: "preparing" | "ready" | "saving" | "needs-tap" | "error"
const SETTLE_MS = 350; // wait for the card to stop changing before drawing it

export function usePreparedPhoto(cardRef, filename) {
  const [status, setStatus] = useState("preparing");
  const fileRef = useRef(null);
  const seqRef = useRef(0);
  const filenameRef = useRef(filename);
  filenameRef.current = filename;

  const prepare = useCallback(async () => {
    const node = cardRef.current;
    if (!node) return null;
    const seq = ++seqRef.current;
    fileRef.current = null;
    setStatus((s) => (s === "saving" ? s : "preparing"));
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      const dataUrl = await toPng(node, { pixelRatio: 2, backgroundColor: "#FFFFFF" });
      const file = await dataUrlToFile(dataUrl, filenameRef.current);
      if (seq !== seqRef.current) return null; // card changed meanwhile; a newer one is coming
      fileRef.current = file;
      setStatus((s) => (s === "saving" ? s : "ready"));
      return file;
    } catch {
      if (seq === seqRef.current) setStatus("error");
      return null;
    }
  }, [cardRef]);

  useEffect(() => {
    const node = cardRef.current;
    if (!node) return undefined;
    let timer = setTimeout(prepare, SETTLE_MS);
    const schedule = () => {
      fileRef.current = null;
      seqRef.current++; // anything in progress is now out of date
      setStatus((s) => (s === "saving" ? s : "preparing"));
      clearTimeout(timer);
      timer = setTimeout(prepare, SETTLE_MS);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(node, { subtree: true, childList: true, characterData: true, attributes: true });
    // Images (like the logo) finishing loading change the picture too.
    node.addEventListener("load", schedule, true);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      node.removeEventListener("load", schedule, true);
      seqRef.current++;
    };
  }, [cardRef, prepare]);

  const save = useCallback(
    async (shareInfo) => {
      setStatus("saving");
      try {
        // Normally ready already; if not (tapped very fast), draw it now.
        const file = fileRef.current || (await prepare());
        if (!file) {
          setStatus("error");
          return;
        }
        const result = await saveFile(file, shareInfo);
        setStatus(result === "needs-tap" ? "needs-tap" : "ready");
      } catch {
        setStatus("error");
      }
    },
    [prepare]
  );

  return { status, save };
}

export function saveButtonLabel(status) {
  if (status === "preparing") return "Preparing…";
  if (status === "saving") return "Saving…";
  if (status === "needs-tap") return "Photo ready, tap to save";
  return "Save as photo";
}
