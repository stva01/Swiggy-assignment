/* Masala Ops shared primitives: compact status language, route progress, and transparent AI metadata. */
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Candidate, RiskLevel, StepStatus } from "@/lib/mockData";

const riskStyles: Record<RiskLevel, string> = {
  low: "bg-[#dcebd8] text-[#4c704f] ring-[#c8dfc2]",
  medium: "bg-[#f9e9bb] text-[#8b641d] ring-[#efd995]",
  high: "bg-[#f7d8cf] text-[#a6442e] ring-[#efbdb0]",
};

export function RiskChip({ risk, overridden = false, className }: { risk: RiskLevel; overridden?: boolean; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold capitalize ring-1 ring-inset", riskStyles[risk], className)}><span className="h-1.5 w-1.5 rounded-full bg-current" />{risk}{overridden ? <span className="ml-0.5 rounded bg-white/60 px-1 py-0.5 font-mono text-[8px] uppercase tracking-[0.08em]">O</span> : null}</span>;
}

const segmentStyles: Record<StepStatus, string> = {
  completed: "bg-[#f56a2a]",
  pending: "bg-[#e8d9c8]",
  overdue: "bg-[#d8593d]",
};

export function JourneyProgress({ steps, showLabel = false }: { steps: Candidate["steps"]; showLabel?: boolean }) {
  const complete = steps.filter((step) => step.status === "completed").length;
  return <div className="flex min-w-[108px] items-center gap-2"><div className="flex flex-1 gap-1">{steps.map((step) => <span key={step.key} title={`${step.shortLabel}: ${step.status}`} className={cn("h-1.5 flex-1 rounded-full", segmentStyles[step.status])} />)}</div>{showLabel ? <span className="whitespace-nowrap font-mono text-[9px] font-bold text-[#a3836b]">{complete}/6</span> : null}</div>;
}

export function FallbackBadge() {
  return <span className="inline-flex items-center gap-1 rounded-md bg-[#f4e8d7] px-1.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-[#a06a4c]"><span className="h-1.5 w-1.5 rounded-full bg-[#f0ab45]" />Fallback</span>;
}

export function LiveAIBadge() {
  return <span className="inline-flex items-center gap-1 rounded-md bg-[#e2eedc] px-1.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-[#537454]"><span className="h-1.5 w-1.5 rounded-full bg-[#6b906d]" />Live AI</span>;
}

export function PendingButton({ pending, children, className, onClick, type = "button" }: { pending: boolean; children: React.ReactNode; className?: string; onClick?: () => void; type?: "button" | "submit" }) {
  return <button type={type} onClick={onClick} disabled={pending} className={cn("pressable focus-ring inline-flex items-center justify-center gap-2 outline-none disabled:cursor-wait disabled:opacity-70", className)}>{pending ? <LoaderCircle className="animate-spin" size={14} /> : null}{pending ? "Working…" : children}</button>;
}

export function Avatar({ initials, tone = "orange", size = "md" }: { initials: string; tone?: "orange" | "sage" | "cocoa" | "yellow"; size?: "sm" | "md" | "lg" }) {
  const tones = { orange: "bg-[#f8d1b7] text-[#9e4b25]", sage: "bg-[#d9e7d5] text-[#527055]", cocoa: "bg-[#e2d5c6] text-[#725744]", yellow: "bg-[#f4e4b7] text-[#87621c]" };
  const sizes = { sm: "h-7 w-7 text-[9px]", md: "h-9 w-9 text-[10px]", lg: "h-11 w-11 text-xs" };
  return <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-extrabold", tones[tone], sizes[size])}>{initials}</span>;
}

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#b3947d]", className)}>{children}</p>;
}
