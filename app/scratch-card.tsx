"use client";
import { useEffect, useRef, useState } from "react";
import type { Feedback } from "../lib/types";
import { Icon } from "./icons";

export default function ScratchCard({ option, index, chosen, feedback, locked, onSelect }: {
  option: string; index: number; chosen: number | null; feedback: Feedback | null; locked: boolean; onSelect: (index: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selectRef = useRef(onSelect); selectRef.current = onSelect;
  const disabledRef = useRef(locked); disabledRef.current = locked;
  const confirmed = useRef(false);
  const [progress, setProgress] = useState(0);
  const selected = chosen === index;
  const correct = feedback?.correctIndex === index;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    let pointer: number | null = null;
    let last: { x: number; y: number } | null = null;
    let lastCheck = 0;
    let initialized = false;
    const paint = () => {
      const width = canvas.getBoundingClientRect().width;
      if (!width) return;
      const old = document.createElement("canvas"); old.width = canvas.width; old.height = canvas.height;
      if (initialized) old.getContext("2d")?.drawImage(canvas, 0, 0);
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(58 * ratio);
      if (initialized) { context.drawImage(old, 0, 0, canvas.width, canvas.height); return; }
      initialized = true;
      context.scale(ratio, ratio);
      context.fillStyle = "#efdae3"; context.fillRect(0, 0, width, 58);
      context.strokeStyle = "#e4bccc"; context.lineWidth = 1;
      for (let x = -60; x < width + 60; x += 16) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x + 58, 58); context.stroke(); }
      context.fillStyle = "#793953"; context.font = "600 11px system-ui"; context.textAlign = "center"; context.textBaseline = "middle";
      context.fillText("✧  RASPÁ PARA ELEGIR  ✧", width / 2, 29);
      context.setTransform(1, 0, 0, 1, 0, 0);
    };
    const measure = () => {
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let clear = 0, samples = 0;
      for (let y = 0; y < canvas.height; y += 4) for (let x = 0; x < canvas.width; x += 4) {
        samples++; if (pixels[(y * canvas.width + x) * 4 + 3] < 128) clear++;
      }
      const fraction = clear / samples;
      setProgress(Math.min(100, Math.round(fraction / .4 * 100)));
      if (fraction >= .4 && !confirmed.current && !disabledRef.current) {
        confirmed.current = true; selectRef.current(index);
      }
    };
    const erase = (event: PointerEvent) => {
      if (disabledRef.current || confirmed.current) return;
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) * canvas.width / rect.width;
      const y = (event.clientY - rect.top) * canvas.height / rect.height;
      context.globalCompositeOperation = "destination-out";
      context.lineWidth = 38 * canvas.height / rect.height; context.lineCap = "round"; context.lineJoin = "round";
      context.beginPath(); context.moveTo(last?.x ?? x, last?.y ?? y); context.lineTo(x + .01, y); context.stroke();
      last = { x, y };
      if (performance.now() - lastCheck > 45) { lastCheck = performance.now(); measure(); }
    };
    const down = (event: PointerEvent) => {
      if (disabledRef.current || confirmed.current || pointer !== null || (event.pointerType === "mouse" && event.button !== 0)) return;
      pointer = event.pointerId; last = null; canvas.setPointerCapture(event.pointerId); erase(event);
    };
    const move = (event: PointerEvent) => { if (pointer === event.pointerId) erase(event); };
    const up = (event: PointerEvent) => {
      if (pointer !== event.pointerId) return;
      if (!disabledRef.current && !confirmed.current) measure();
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      pointer = null; last = null;
    };
    paint(); const observer = new ResizeObserver(paint); observer.observe(canvas);
    canvas.addEventListener("pointerdown", down); canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
    return () => { observer.disconnect(); canvas.removeEventListener("pointerdown", down); canvas.removeEventListener("pointermove", move); canvas.removeEventListener("pointerup", up); canvas.removeEventListener("pointercancel", up); };
  }, [index]);
  return <article className={`option-card ${selected ? "is-selected" : ""} ${correct ? "is-correct" : ""} ${locked && !selected && !correct ? "is-muted" : ""}`}>
    <div className="option-copy"><span className="option-letter">{"ABC"[index]}</span><span>{option}</span>{feedback && (correct || selected) && <Icon name={correct ? "check" : "close"} />}</div>
    <div className="scratch-area">
      <span>{selected ? <><Icon name="check" size={16} /> Tu respuesta</> : correct ? <><Icon name="check" size={16} /> Respuesta correcta</> : locked ? "Opción bloqueada" : "Tu respuesta empieza acá"}</span>
      <canvas ref={canvasRef} aria-hidden="true" className={locked ? "canvas-hidden" : ""} />
    </div>
    <div className="option-bottom"><button type="button" disabled={locked} onClick={() => { if (!confirmed.current) { confirmed.current = true; onSelect(index); } }} aria-label={`Seleccionar opción ${"ABC"[index]}: ${option}`}>{locked ? selected ? "Elección confirmada" : correct ? "Respuesta correcta" : "No seleccionada" : "Elegir sin raspar"}</button>{!locked && progress > 0 && <span>{progress}%</span>}</div>
  </article>;
}
