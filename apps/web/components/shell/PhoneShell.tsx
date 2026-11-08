import { useEffect, useState, type ReactNode } from "react";

export function PhoneShell({ children }: { children: ReactNode }) {
  const [platform, setPlatform] = useState<"ios" | "android">("ios");

  useEffect(() => {
    const isAndroidPhone = /Android/i.test(navigator.userAgent)
      && Math.min(window.innerWidth, window.innerHeight) <= 600;
    setPlatform(isAndroidPhone ? "android" : "ios");
  }, []);

  return <main className="device-stage" aria-label="Trip planner"><section className="device-frame"><div className="app-viewport" data-platform-ui={platform}>{children}</div></section></main>;
}
