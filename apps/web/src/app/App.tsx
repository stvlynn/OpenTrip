import { useEffect, useState } from "react";
import { AppProviders } from "./providers";
import { RouterProvider, useRouter, matchTripId, matchInviteToken, isKnownPath } from "./router";
import { AppErrorBoundary } from "./AppErrorBoundary";
import { resolveInitialSession } from "./auth-session-state";
import { useSession } from "@/shared/auth";
import { Spinner } from "@/shared/ui/spinner";
import { AuthPage } from "@/pages/auth";
import { LandingPage } from "@/pages/landing";
import { InvitePage } from "@/pages/invite";
import { TripsPage } from "@/pages/trips";
import { TravelPlannerPage } from "@/pages/travel-planner";
import { ErrorPage } from "@/pages/error";
import { SettingsDialog } from "@/widgets/settings-dialog";

function Routes() {
  const { path } = useRouter();
  const tripId = matchTripId(path);
  if (tripId) return <TravelPlannerPage tripId={tripId} />;
  return <TripsPage />;
}

function Gate({
  isAuthenticated,
  initialSessionResolved,
}: {
  isAuthenticated: boolean;
  initialSessionResolved: boolean;
}) {
  const { path } = useRouter();
  const inviteToken = matchInviteToken(path);

  if (!initialSessionResolved) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  // The invite route handles both authenticated and unauthenticated visitors,
  // preserving `/invite/:token` through sign-in so the accept step can continue.
  if (inviteToken) {
    return <InvitePage token={inviteToken} isAuthenticated={isAuthenticated} />;
  }

  // Unrecognized paths render the 404 surface for everyone rather than silently
  // falling back to the trips home.
  if (!isKnownPath(path)) return <ErrorPage variant="404" />;

  if (!isAuthenticated) {
    // Web visitors land on the marketing page at the root; the auth form lives
    // at `/signin`. Deep links (e.g. a shared trip) still route straight to
    // sign-in so the target path survives login.
    if (path === "/") return <LandingPage />;
    return <AuthPage />;
  }

  return (
    <>
      <Routes />
      <SettingsDialog />
    </>
  );
}

function AppContent() {
  const { data: session, isPending, isRefetching } = useSession();
  const [initialSessionResolved, setInitialSessionResolved] = useState(false);
  const isAuthenticated = Boolean(session);
  const sessionBusy = isPending || isRefetching;

  useEffect(() => {
    // Latch after the first definitive result. Later logged-out refetches must
    // not remount AuthForm and erase an in-progress OTP or two-factor step.
    setInitialSessionResolved((current) =>
      resolveInitialSession(current, { isAuthenticated, sessionBusy }),
    );
  }, [isAuthenticated, sessionBusy]);

  return (
    <Gate
      isAuthenticated={isAuthenticated}
      initialSessionResolved={initialSessionResolved}
    />
  );
}

export function App() {
  return (
    <AppProviders>
      <RouterProvider>
        <AppErrorBoundary>
          <AppContent />
        </AppErrorBoundary>
      </RouterProvider>
    </AppProviders>
  );
}
