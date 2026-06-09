const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

function isEnabled(value) {
  return TRUE_VALUES.has(String(value || "").trim().toLowerCase());
}

function isLocalBrowser() {
  if (typeof window === "undefined") return false;
  return LOCAL_HOSTNAMES.has(window.location.hostname);
}

const IS_LOCAL_DEV = import.meta.env.DEV && isLocalBrowser();

// Local-only emergency/testing bypass. Never use this for deployed builds.
export const LOCAL_ADMIN_BYPASS = (
  IS_LOCAL_DEV &&
  isEnabled(import.meta.env.VITE_LOCAL_ADMIN_BYPASS)
);

// UI-only local preview flag. This reveals links; it does not authorize routes.
export const SHOW_ALL_NAV = (
  IS_LOCAL_DEV &&
  (
    LOCAL_ADMIN_BYPASS ||
    isEnabled(import.meta.env.VITE_SHOW_ALL_NAV)
  )
);
