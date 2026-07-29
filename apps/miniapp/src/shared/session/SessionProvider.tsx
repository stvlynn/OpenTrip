import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { PropsWithChildren } from "react";

import { ensureSession, type SessionUser } from "./session";

export type SessionStatus = "loading" | "ready" | "error";

interface SessionContextValue {
  status: SessionStatus;
  user: SessionUser | null;
  retry: () => void;
}

const SessionContext = createContext<SessionContextValue>({
  status: "loading",
  user: null,
  retry: () => undefined,
});

/** Signs in with WeChat once per app launch and shares the resulting user. */
export function SessionProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    ensureSession()
      .then((signedIn) => {
        if (!active) return;
        setUser(signedIn);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error("OpenTrip sign-in failed", error);
        setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return (
    <SessionContext.Provider value={{ status, user, retry }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  return useContext(SessionContext);
}
