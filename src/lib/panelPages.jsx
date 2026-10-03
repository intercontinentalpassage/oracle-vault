import { lazy, useEffect, useState } from "react";

// Admin and Agent panel pages, loaded lazily so storefront visitors never
// download them (see App.jsx). Each page also gets a .preload() so the
// panel can fetch the other pages in the background once it's open —
// clicking a sidebar tab for the first time is then instant.

function lazyPage(factory) {
  const Page = lazy(factory);
  // The browser caches the module, so preload + the later render share
  // one download.
  Page.preload = factory;
  return Page;
}

export const AdminTickets = lazyPage(() => import("../pages/admin/AdminTickets"));
export const AdminGroups = lazyPage(() => import("../pages/admin/AdminGroups"));
export const AdminPurchaseRequests = lazyPage(() => import("../pages/admin/AdminPurchaseRequests"));
export const AdminAgents = lazyPage(() => import("../pages/admin/AdminAgents"));
export const AdminCustomers = lazyPage(() => import("../pages/admin/AdminCustomers"));
export const AdminRefunds = lazyPage(() => import("../pages/admin/AdminRefunds"));
export const AdminLogins = lazyPage(() => import("../pages/admin/AdminLogins"));
export const AdminDraws = lazyPage(() => import("../pages/admin/AdminDraws"));
export const AdminTranslations = lazyPage(() => import("../pages/admin/AdminTranslations"));
export const AdminSettings = lazyPage(() => import("../pages/admin/AdminSettings"));

export const AgentCatalog = lazyPage(() => import("../pages/agent/AgentCatalog"));
export const AgentCustomers = lazyPage(() => import("../pages/agent/AgentCustomers"));
export const AgentSales = lazyPage(() => import("../pages/agent/AgentSales"));
export const AgentRefunds = lazyPage(() => import("../pages/agent/AgentRefunds"));
export const AgentSettings = lazyPage(() => import("../pages/agent/AgentSettings"));

export const ADMIN_PAGES = [
  AdminTickets, AdminGroups, AdminPurchaseRequests, AdminAgents, AdminCustomers,
  AdminRefunds, AdminLogins, AdminDraws, AdminTranslations, AdminSettings,
];
export const AGENT_PAGES = [AgentCatalog, AgentCustomers, AgentSales, AgentRefunds, AgentSettings];

const whenIdle = (fn) =>
  window.requestIdleCallback ? window.requestIdleCallback(fn, { timeout: 3000 }) : setTimeout(fn, 1200);

// Download the panel's other pages one at a time while the browser is idle,
// so it never competes with the page the user is actually looking at.
export function usePreloadPages(pages, enabled) {
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    const queue = [...pages];
    function next() {
      if (cancelled || queue.length === 0) return;
      const page = queue.shift();
      page
        .preload()
        .catch(() => {}) // offline etc. — it will just load on click instead
        .finally(() => whenIdle(next));
    }
    whenIdle(next);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}

// Shown in the content area only (the sidebar stays) while a page loads.
// Waits a moment before appearing, so a quick load shows nothing at all
// instead of a flash.
export function PanelLoading() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 250);
    return () => clearTimeout(timer);
  }, []);
  if (!show) return null;
  return (
    <div className="ov-panel-loading" role="status" aria-label="Loading">
      <span className="ov-panel-spinner" />
    </div>
  );
}
