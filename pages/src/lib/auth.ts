/**
 * Auth token storage. localStorage is used over cookies because the API
 * is on a different subdomain (api.phenologue.uk) and CSRF protection is
 * already handled by the bearer-token model + same-site SPA navigation.
 */

const TOKEN_KEY = 'phenologue.token';
const PATIENT_KEY = 'phenologue.patient_id';

export function getToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string, patientId: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(PATIENT_KEY, patientId);
}

export function clearToken(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(PATIENT_KEY);
}

export function getPatientId(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(PATIENT_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
