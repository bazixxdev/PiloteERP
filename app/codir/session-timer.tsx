"use client";

import { useEffect, useState } from "react";

// Repère de séance : le CODIR se tient en 20 minutes (proposition du cahier des charges).
export function SessionTimer({ minutes }: { minutes: number }) {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const s = Math.floor((now - start) / 1000);
  const over = s > minutes * 60;
  return <span className={over ? "font-semibold text-danger" : "tabular"} title={`Séance de ${minutes} minutes`}>{String(Math.floor(s / 60)).padStart(2, "0")}:{String(s % 60).padStart(2, "0")} / {minutes}:00</span>;
}
