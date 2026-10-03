import { useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";

// Keeps a page's ticket list in sync with the database while it is open,
// using Supabase Realtime. When anyone sells, adds, moves or deletes a ticket
// (admin, an agent, the Telegram bot), every open storefront updates within a
// second or two instead of waiting for a refresh.
//
// Phones often drop the live connection when the screen locks or the tab goes
// to the background, and any changes during that time are simply missed. So
// the page also re-fetches its list ("resync") when:
//   - the tab becomes visible again after being hidden for a few seconds
//   - the browser comes back online
//   - the live connection reconnects after dropping
//
// Options:
//   channelName  unique name for this page's subscription
//   enabled      false until the page knows enough to filter (e.g. agent loaded)
//   belongsHere  (row) => true if this ticket should be in this page's list
//   setTickets   the page's state setter for its raw ticket list
//   resync       async () => re-fetch the page's data quietly (no spinner)
//   onGone       (ids) => called with ticket ids that are no longer available
//   shouldResync (row) => true if a change can't be applied locally (e.g. it
//                points at a draw this page hasn't loaded) — triggers a resync

const FLUSH_MS = 250; // batch bursts (e.g. a 100-ticket upload) into one re-render
const HIDDEN_RESYNC_MS = 5000; // only resync after being hidden at least this long

function sortByNumber(a, b) {
  return a.number < b.number ? -1 : a.number > b.number ? 1 : 0;
}

export function useLiveTickets({ channelName, enabled = true, belongsHere, setTickets, resync, onGone, shouldResync }) {
  // Always call the latest callbacks without re-subscribing on every render.
  const latest = useRef({});
  latest.current = { belongsHere, setTickets, resync, onGone, shouldResync };

  useEffect(() => {
    if (!enabled) return undefined;

    let buffer = [];
    let flushTimer = null;
    let everSubscribed = false;
    let hiddenAt = null;
    let resyncing = false;
    let resyncQueued = false;
    let heldDuringResync = [];
    let disposed = false;

    function applyEvents(events) {
      if (!events.length) return;
      const { belongsHere: belongs, setTickets: set, onGone: gone, shouldResync: needs } = latest.current;

      set((prev) => {
        const byId = new Map(prev.map((tk) => [tk.id, tk]));
        for (const ev of events) {
          if (ev.eventType === "DELETE") {
            byId.delete(ev.old?.id);
          } else if (belongs(ev.new)) {
            byId.set(ev.new.id, ev.new);
          } else {
            byId.delete(ev.new.id); // e.g. admin moved it to an agent's shop
          }
        }
        return [...byId.values()].sort(sortByNumber);
      });

      const goneIds = [];
      for (const ev of events) {
        if (ev.eventType === "DELETE") goneIds.push(ev.old?.id);
        else if (ev.new.status !== "available") goneIds.push(ev.new.id);
      }
      if (gone && goneIds.length) gone(goneIds.filter(Boolean));

      if (needs && events.some((ev) => ev.eventType !== "DELETE" && needs(ev.new))) {
        runResync();
      }
    }

    function flush() {
      flushTimer = null;
      const events = buffer;
      buffer = [];
      applyEvents(events);
    }

    function queue(ev) {
      // Changes that arrive while a resync is fetching are replayed on top of
      // its result, so an older snapshot can't bring back a just-sold number.
      if (resyncing) heldDuringResync.push(ev);
      buffer.push(ev);
      if (!flushTimer) flushTimer = setTimeout(flush, FLUSH_MS);
    }

    async function runResync() {
      if (resyncing) {
        resyncQueued = true;
        return;
      }
      resyncing = true;
      heldDuringResync = [];
      try {
        await latest.current.resync?.();
      } catch {
        // keep showing what we have; the next trigger will try again
      } finally {
        resyncing = false;
        if (!disposed && heldDuringResync.length) applyEvents(heldDuringResync);
        heldDuringResync = [];
        if (resyncQueued && !disposed) {
          resyncQueued = false;
          runResync();
        }
      }
    }

    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, queue)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // First connect: the page just loaded, nothing to catch up on.
          // Any later SUBSCRIBED is a reconnect, so changes may have been missed.
          if (everSubscribed) runResync();
          everSubscribed = true;
        }
      });

    function onVisibility() {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
      } else if (hiddenAt && Date.now() - hiddenAt >= HIDDEN_RESYNC_MS) {
        hiddenAt = null;
        runResync();
      } else {
        hiddenAt = null;
      }
    }
    function onOnline() {
      runResync();
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);

    return () => {
      disposed = true;
      clearTimeout(flushTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      supabase.removeChannel(channel);
    };
  }, [channelName, enabled]);
}
