const PENDING_INVITE_KEY = "lfp_pending_invite";

export function getInviteCodeFromSearch(search) {
  const code = new URLSearchParams(search || "").get("invite");
  const trimmed = String(code || "").trim();
  return /^\d+$/.test(trimmed) ? trimmed : "";
}

export function storePendingInviteCode(inviteCode) {
  const trimmed = String(inviteCode || "").trim();
  if (!/^\d+$/.test(trimmed)) return;

  try {
    localStorage.setItem(PENDING_INVITE_KEY, trimmed);
  } catch {
    // localStorage can be unavailable in private contexts.
  }
}

export function getPendingInviteCode() {
  try {
    const inviteCode = localStorage.getItem(PENDING_INVITE_KEY) || "";
    return /^\d+$/.test(inviteCode) ? inviteCode : "";
  } catch {
    return "";
  }
}

export function clearPendingInviteCode() {
  try {
    localStorage.removeItem(PENDING_INVITE_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
}

export function buildInviteUrl(inviteCode) {
  const configuredUrl = import.meta.env.VITE_SITE_URL?.replace(/\/$/, "");
  const fallbackUrl = typeof window !== "undefined" ? window.location.origin : "https://letsfindpeople.com";
  const baseUrl = configuredUrl || fallbackUrl;
  return `${baseUrl}/?invite=${encodeURIComponent(inviteCode)}`;
}
