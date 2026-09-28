/**
 * The page each role lands on — after login, from the "home" keyboard shortcut,
 * after submitting a form, and when a guard turns a user away.
 * One place, so changing a role's home is a one-line edit.
 *
 *   E (employee) → the new DPR employee dashboard
 *   H (HOD)      → the new DPR HOD dashboard
 *   C (CED)      → the DPR usage dashboard
 */
export const HOME_ROUTES: Record<string, string> = {
  E: '/dpr-employee-dashboard',
  H: '/dpr-hod-dashboard',
  C: '/ced-dpr-analytics'
};

/** Reads isHOD from the given user, or from the stored session when omitted. */
export function homeRouteFor(user?: { isHOD?: unknown } | null): string {
  let u = user;
  if (!u) {
    try { u = JSON.parse(localStorage.getItem('current_user') || '{}'); } catch { u = {}; }
  }
  const code = (u?.isHOD ?? '').toString().trim().toUpperCase();
  return HOME_ROUTES[code] ?? HOME_ROUTES['E'];
}
