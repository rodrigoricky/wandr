import type { ReactNode } from "react";

export function PhoneShell({ children }: { children: ReactNode }) {
  return <main className="min-h-[100dvh] w-full bg-[var(--canvas)] sm:flex sm:items-center sm:justify-center sm:p-3"><section className="device-frame" aria-label="Wandr trip planner"><div className="app-viewport">{children}</div></section></main>;
}
