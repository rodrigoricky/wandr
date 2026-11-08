import type { ReactNode } from "react";

export function PhoneShell({ children }: { children: ReactNode }) {
  return <main className="device-stage" aria-label="Trip planner"><section className="device-frame"><div className="app-viewport">{children}</div></section></main>;
}
