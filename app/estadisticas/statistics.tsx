"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Stats } from "../../lib/types";
import { Icon, Ribbon } from "../icons";
export default function Statistics({ apiOrigin = "", gameUrl = "/", qrUrl = "/acceso-qr.svg" }: { apiOrigin?: string; gameUrl?: string; qrUrl?: string }) {
  const [stats, setStats] = useState<Stats | null>(null); const [error, setError] = useState("");
  const [busy, setBusy] = useState(true); const [hasLink, setHasLink] = useState<boolean | null>(null); const [updated, setUpdated] = useState("");
  const accessToken = useRef("");
  const load = useCallback(async () => {
    const token = accessToken.current;
    if (!/^[a-f0-9]{64}$/.test(token)) { setHasLink(false); setStats(null); setBusy(false); return; }
    setHasLink(true);
    setBusy(true); setError("");
    try {
      const response = await fetch(`${apiOrigin}/api/stats`, { credentials: apiOrigin ? "omit" : "same-origin", headers: { Authorization: `Bearer ${token}` }, cache: "no-store", referrerPolicy: "no-referrer", signal: AbortSignal.timeout(15000) });
      if (accessToken.current !== token) return;
      if (response.status === 401 || response.status === 403) { setHasLink(false); setStats(null); return; }
      const data = await response.json() as Stats & { error?: string };
      if (!response.ok) throw new Error(data.error || "No pudimos cargar las estadísticas.");
      setStats(data); setUpdated(new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }));
    } catch (e) { if (accessToken.current === token) setError(e instanceof Error ? e.message : "No pudimos cargar las estadísticas. Intentá nuevamente."); }
    finally { if (accessToken.current === token) setBusy(false); }
  }, [apiOrigin]);
  useEffect(() => {
    const readLink = () => { accessToken.current = new URLSearchParams(window.location.hash.slice(1)).get("acceso") || ""; setStats(null); void load(); };
    readLink(); window.addEventListener("hashchange", readLink);
    const interval = setInterval(() => { if (document.visibilityState === "visible" && accessToken.current) void load(); }, 30000);
    return () => { clearInterval(interval); window.removeEventListener("hashchange", readLink); };
  }, [load]);
  if (hasLink === null) return <div className="site-shell"><main className="restricted"><p role="status">Cargando…</p></main></div>;
  if (!hasLink) return <div className="site-shell"><main className="restricted"><h1>Enlace no válido</h1><p>Usá el enlace de estadísticas que te compartieron.</p><a className="text-button" href={gameUrl}>Ir al juego</a></main></div>;
  return <div className="site-shell"><header className="header"><a className="brand" href={gameUrl}><Ribbon className="brand-ribbon"/><span>Octubre <span className="brand-rosa">Rosa</span></span></a><a className="back-link" href={gameUrl}>Volver al juego <Icon name="arrow" size={17}/></a></header><main id="main" className="stats-section"><div className="stats-heading"><h1>Estadísticas</h1><button className="button secondary" onClick={load} disabled={busy}><Icon name="refresh" size={17}/>{busy ? "Actualizando…" : "Actualizar"}</button></div>
    {error && <div className="error-box" role="alert"><Icon name="info"/><p>{error}</p></div>}
    <div className="stats-cards" aria-live="polite">{[{ label: "Partidas completadas", value: stats?.total, icon: "chart" }, { label: "Partidas correctas", value: stats?.correct, icon: "check" }, { label: "Partidas incorrectas", value: stats?.incorrect, icon: "info" }, { label: "Porcentaje de partidas correctas", value: stats ? `${stats.correctPercentage.toLocaleString("es-AR")}%` : undefined, icon: "sparkle" }].map((card, i) => <article key={card.label} className={`stat-card ${i === 0 ? "featured" : ""}`}><span className="stat-icon"><Icon name={card.icon} size={22}/></span><p>{card.label}</p><strong>{card.value === undefined ? "—" : typeof card.value === "number" ? card.value.toLocaleString("es-AR") : card.value}</strong></article>)}</div>
    {stats && <section className="distribution"><div><h2>Resultados</h2><span>{updated && `Actualizado: ${updated}`}</span></div>{stats.total > 0 ? <><div className="distribution-track" role="img" aria-label={`${stats.correctPercentage}% de partidas correctas; ${Math.round((100 - stats.correctPercentage) * 10) / 10}% incorrectas`}><span style={{ width: `${stats.correctPercentage}%` }}/></div><div className="distribution-legend"><span><i/> Correctas · {stats.correct}</span><span><i/> Incorrectas · {stats.incorrect}</span></div></> : <div className="empty-state"><h3>Todavía no hay partidas completadas.</h3><a href={gameUrl} className="text-button">Ir al juego <Icon name="arrow" size={16}/></a></div>}</section>}
    <p className="stats-footnote">Solo se cuentan partidas finalizadas. Actualización cada 30 segundos.</p><section className="access-qr"><h2>Acceso al juego</h2><img src={qrUrl} width="180" height="180" alt="QR para abrir Octubre Rosa"/><a className="text-button" href={qrUrl} download="octubre-rosa-qr.svg">Descargar QR</a></section></main><footer className="footer"><span>Octubre Rosa</span></footer></div>;
}
