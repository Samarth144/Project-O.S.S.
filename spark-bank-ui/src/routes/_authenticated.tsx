import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { isAuthed } from "@/lib/auth";
import { AppLayout } from "@/components/AppLayout";

export const Route = createFileRoute("/_authenticated")({
  component: AuthedLayout,
});

function AuthedLayout() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isAuthed()) {
      navigate({ to: "/login", replace: true });
    } else {
      setReady(true);
    }
  }, [navigate]);

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}

// silence unused import warning
export const _unused = redirect;
