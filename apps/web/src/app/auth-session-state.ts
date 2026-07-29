export interface SessionStatus {
  isAuthenticated: boolean;
  sessionBusy: boolean;
}

export function resolveInitialSession(
  wasResolved: boolean,
  status: SessionStatus,
): boolean {
  return wasResolved || status.isAuthenticated || !status.sessionBusy;
}
