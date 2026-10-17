import type { CSSProperties } from "react";
export function Icon({ name, size = 20, style }: { name: string; size?: number; style?: CSSProperties }) {
  const paths: Record<string, React.ReactNode> = {
    arrow: <><path d="M4 12h15M13 5l7 7-7 7" /></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    hand: <><path d="M8 13V5a2 2 0 0 1 4 0v6-7a2 2 0 0 1 4 0v7-4a2 2 0 0 1 4 0v8a7 7 0 0 1-12 5l-5-6a2 2 0 0 1 3-3l2 2Z" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
    share: <><path d="M12 16V3m-4 4 4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></>,
    chart: <><path d="M4 3v17h17M9 16v-5m5 5V6m5 10v-7" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 13 3M5 15a8 8 0 0 0 13 3" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    sparkle: <><path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Z" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7v.5" /></>,
    link: <><path d="m10 13 4-4m-6 6-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m2 2 2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" transform="translate(1 1)" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>{paths[name] || paths.heart}</svg>;
}
export function Ribbon({ className = "" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 210 300" fill="none" aria-hidden="true"><defs><linearGradient id="ribbon-front" x1="38" y1="82" x2="163" y2="254" gradientUnits="userSpaceOnUse"><stop stopColor="#ed78a8"/><stop offset=".6" stopColor="#d9387f"/><stop offset="1" stopColor="#a91659"/></linearGradient><linearGradient id="ribbon-back" x1="138" y1="59" x2="64" y2="239" gradientUnits="userSpaceOnUse"><stop stopColor="#a21655"/><stop offset=".5" stopColor="#dc4c8c"/><stop offset="1" stopColor="#ef9bbe"/></linearGradient></defs><path d="M72 48C85 22 124 21 140 48c22 38-7 92-39 140l-47 76-37-29 64-95c28-43 47-68 36-88-8-13-29-13-39 1Z" fill="url(#ribbon-back)"/><path d="M72 48C50 81 73 122 103 166l58 98 37-30-64-96c-27-42-47-67-35-86 9-13 28-13 38 1-15-28-50-32-65-5Z" fill="url(#ribbon-front)"/><path d="M77 46c10-17 34-19 49-8" stroke="#ffb5d3" strokeWidth="3" opacity=".6"/></svg>;
}
