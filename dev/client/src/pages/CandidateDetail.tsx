/* Masala Ops detail view: human context first, with service-line journey steps and transparent AI assistance. */
import { useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, Check, ChevronRight, CircleAlert, Clock3, FileText, Mail, MapPin, MessageCircle, MoreHorizontal, Pencil, Phone, RefreshCw, Send, ShieldCheck, Sparkles, UserRound, X } from "lucide-react";
import { Link, useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import { Avatar, FallbackBadge, LiveAIBadge, PendingButton, RiskChip, SectionLabel } from "@/components/SharedPrimitives";
import { bootstrapCandidate, createManualInteraction, createRiskOverride, fetchCandidateDetail, fetchCandidateState, requestCandidateAnalysis, requestGeneratedMessage, updateJourneyStep, type CandidateAIContext, type CandidateAnalysisResponse, type CandidateState, type MessageTone } from "@/lib/api";
import { useNotifications } from "@/contexts/NotificationContext";
import { candidates as seedCandidates, interactions as seedInteractions, type Candidate, type RiskLevel, type StepStatus } from "@/lib/mockData";
import { cn } from "@/lib/utils";

export default function CandidateDetail() {
  const [, params] = useRoute("/candidates/:id");
  const [, navigate] = useLocation();
  const seed = seedCandidates.find((candidate) => candidate.id === params?.id);
  const [candidate, setCandidate] = useState<Candidate>(() => seed ?? seedCandidates[1]);
  const { addNotification } = useNotifications();
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [interactions, setInteractions] = useState(seedInteractions);
  const [composer, setComposer] = useState<{ channel: string; tone: MessageTone; draft: string }>({ channel: "WhatsApp", tone: "Friendly", draft: "" });
  const [generating, setGenerating] = useState(false);
  const [manualMessage, setManualMessage] = useState("");
  const [aiAnalysis, setAiAnalysis] = useState<CandidateAnalysisResponse | null>(null);
  const [lastAIRefresh, setLastAIRefresh] = useState("Not refreshed yet");

  const completedCount = candidate.steps.filter((step) => step.status === "completed").length;
  const overdueCount = candidate.steps.filter((step) => step.status === "overdue").length;
  const effectiveLabel = candidate.overrideReason ? `Override: ${candidate.risk[0].toUpperCase()}${candidate.risk.slice(1)} by Nisha Rao` : `AI: ${candidate.risk[0].toUpperCase()}${candidate.risk.slice(1)}`;
  const candidateAIContext = (): CandidateAIContext => ({ candidateId: candidate.id, candidateName: candidate.name, role: candidate.role, location: candidate.location, joiningDate: candidate.joiningDate, daysToJoin: candidate.daysToJoin, risk: candidate.risk, nextAction: candidate.nextAction, interactions: interactions.slice(0, 12).map(({ channel, direction, timestamp, text }) => ({ channel, direction: direction === "in" ? "in" : "out", timestamp, text })) });

  const applyPersistedState = (state: CandidateState) => {
    setCandidate((current) => ({ ...current, risk: state.risk, aiRisk: state.aiRisk, overrideReason: state.overrideReason ?? undefined, steps: current.steps.map((step) => ({ ...step, status: state.steps[step.key] ?? step.status })) }));
    setInteractions(state.interactions);
  };

  useEffect(() => {
    let active = true;
    if (!params?.id) return () => { active = false; };
    if (seed) {
      void bootstrapCandidate({ candidateId: seed.id, name: seed.name, email: seed.email, role: seed.role, department: seed.department, location: seed.location, recruiter: seed.recruiter, offerDate: seed.offerDate, joiningDate: seed.joiningDate, risk: seed.risk, aiRisk: seed.aiRisk, steps: seed.steps.map(({ key, label, status }) => ({ key, label, status })), interactions: seedInteractions.map(({ channel, direction, text, tone }) => ({ channel, direction: direction === "in" ? "in" : "out", text, tone })) }).then((state) => { if (active) applyPersistedState(state); }).catch(() => { if (active) toast("Local database is unavailable — working in demo mode"); });
    } else {
      void Promise.all([fetchCandidateDetail(params.id), fetchCandidateState(params.id)]).then(([detail, state]) => { if (!active) return; setCandidate(detail); applyPersistedState(state); }).catch(() => { if (active) toast("Candidate could not be loaded from the database"); });
    }
    return () => { active = false; };
  }, [params?.id]);

  const toggleStep = async (key: string) => {
    const previous = candidate;
    const step = candidate.steps.find((item) => item.key === key);
    if (!step) return;
    const nextStatus = step.status === "completed" ? "pending" : "completed";
    setCandidate((current) => ({ ...current, steps: current.steps.map((item) => item.key === key ? { ...item, status: nextStatus } : item) }));
    try {
      applyPersistedState(await updateJourneyStep(candidate.id, key, nextStatus));
      toast("Journey step saved");
    } catch {
      setCandidate(previous);
      toast("Journey step could not be saved");
    }
  };

  const regenerate = async () => {
    setRegenerating(true);
    try {
      const result = await requestCandidateAnalysis(candidateAIContext());
      const previousRisk = candidate.risk;
      setAiAnalysis(result);
      setCandidate((current) => ({ ...current, aiRisk: result.risk, risk: current.overrideReason ? current.risk : result.risk }));
      setLastAIRefresh("Just now");
      if (!candidate.overrideReason && previousRisk !== result.risk) addNotification({ kind: "risk", title: "AI risk status changed", body: `${candidate.name} is now assessed as ${result.risk} risk. Review the evidence before acting.` });
      toast("AI risk briefing refreshed");
    } catch {
      toast("AI analysis is unavailable — the current briefing was kept");
    } finally {
      setRegenerating(false);
    }
  };

  const generateDraft = async () => {
    setGenerating(true);
    try {
      const result = await requestGeneratedMessage({ ...candidateAIContext(), channel: composer.channel, tone: composer.tone });
      setComposer((current) => ({ ...current, draft: result.draft }));
      toast(`Draft generated in ${composer.tone.toLowerCase()} tone`);
    } catch {
      const firstName = candidate.name.split(" ")[0];
      const fallback = composer.tone === "Formal" ? `Hello ${firstName}, with your ${candidate.joiningDayLabel} start approaching, I wanted to check whether we can assist with ${candidate.nextAction.toLowerCase()}. Please let me know a convenient time to help.` : composer.tone === "Urgent" ? `Hi ${firstName} — your ${candidate.joiningDayLabel} start is close. Can we confirm ${candidate.nextAction.toLowerCase()} today so nothing gets in the way of day one?` : `Hi ${firstName} — with your ${candidate.joiningDayLabel} start coming up, I wanted to check whether there is anything we can make easier before day one. Happy to help with the next step.`;
      setComposer((current) => ({ ...current, draft: fallback }));
      toast("FastAPI is offline — drafted with the local fallback");
    } finally {
      setGenerating(false);
    }
  };

  const sendDraft = async () => {
    if (!composer.draft.trim()) { toast("Generate or write a message first"); return; }
    try {
      const saved = await createManualInteraction(candidate.id, { channel: composer.channel, text: composer.draft, tone: "Simulated send" });
      setInteractions((current) => [saved, ...current]);
      setComposer((current) => ({ ...current, draft: "" }));
      toast("Message logged — simulated send only");
    } catch { toast("Message could not be saved"); }
  };

  const addManualInteraction = async () => {
    if (!manualMessage.trim()) return;
    try {
      const saved = await createManualInteraction(candidate.id, { channel: "Note", text: manualMessage });
      setInteractions((current) => [saved, ...current]);
      setManualMessage("");
      toast("Interaction saved to the candidate record");
    } catch { toast("Manual log could not be saved"); }
  };

  const saveRiskOverride = async (level: RiskLevel, reason: string) => {
    try {
      applyPersistedState(await createRiskOverride(candidate.id, level, reason, candidate.recruiter));
      setOverrideOpen(false);
      addNotification({ kind: "risk", title: "Risk status changed", body: `${candidate.name} is now marked ${level} risk by human override.` });
      toast("Risk override saved");
    } catch { toast("Risk override could not be saved"); }
  };

  return <div className="space-y-7">
    <div className="flex flex-wrap items-center justify-between gap-3"><button onClick={() => navigate("/")} className="focus-ring inline-flex items-center gap-2 text-xs font-extrabold text-[#856854] outline-none hover:text-[#f56a2a]"><ArrowLeft size={15} /> Back to offer desk</button><div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#b3947d]"><span>Offer desk</span><ChevronRight size={12} /><span>{candidate.id}</span></div></div>

    <section className="reveal-up overflow-hidden rounded-[26px] border border-[#eadcca] bg-[#fbf7f0] shadow-[0_16px_36px_rgba(91,57,36,0.065)]"><div className="relative grid gap-7 p-6 sm:p-8 lg:grid-cols-[1fr_300px] lg:p-9"><div className="absolute right-0 top-0 hidden h-full w-[34%] overflow-hidden bg-[#f7e6d2] opacity-70 lg:block"><img src="/manus-storage/candidate-detail-illustration_b1e53baa.png" alt="" className="h-full w-full object-cover mix-blend-multiply" /></div><div className="relative z-10"><div className="flex flex-wrap items-start gap-4"><Avatar initials={candidate.initials} tone={candidate.risk === "high" ? "orange" : "sage"} size="lg" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="display-face text-[34px] leading-none text-[#3c2920]">{candidate.name}</h2><RiskChip risk={candidate.risk} overridden={Boolean(candidate.overrideReason)} /></div><p className="mt-2 text-sm font-extrabold text-[#725744]">{candidate.role}</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-semibold text-[#a38570]"><span className="inline-flex items-center gap-1.5"><MapPin size={13} />{candidate.location}</span><span className="inline-flex items-center gap-1.5"><UserRound size={13} />{candidate.recruiter}</span><span className="inline-flex items-center gap-1.5"><Mail size={13} />{candidate.email}</span></div></div></div><div className="mt-8 grid gap-3 sm:grid-cols-3"><InfoStat label="Offer date" value={candidate.offerDate} icon={FileText} /><InfoStat label="Joining date" value={candidate.joiningDate} icon={CalendarDays} /><InfoStat label="Days to join" value={`${candidate.daysToJoin} days`} helper={candidate.daysToJoin <= 7 ? "Final stretch" : "Good runway"} icon={Clock3} highlight={candidate.daysToJoin <= 7} /></div></div><div className="relative z-10 rounded-[20px] bg-[#3c2920] p-5 text-[#fff9f0] shadow-[0_14px_28px_rgba(60,41,32,0.13)]"><div className="mb-5 flex items-center gap-2"><span className="h-1.5 w-8 rounded-full bg-[#f56a2a]" /><span className="h-1.5 w-1.5 rounded-full bg-[#f56a2a]" /><span className="h-1.5 w-1.5 rounded-full bg-white/30" /><span className="h-1.5 w-1.5 rounded-full bg-white/30" /></div><div className="flex items-center justify-between"><SectionLabel className="text-[#c7a990]">Effective risk</SectionLabel><button aria-label="Risk options" onClick={() => toast("Risk options are available below") } className="rounded-lg p-1 text-[#c7a990] hover:bg-white/10"><MoreHorizontal size={16} /></button></div><div className="mt-6 flex items-end gap-3"><span className="display-face text-[50px] leading-none capitalize text-[#f56a2a]">{candidate.risk}</span><span className="mb-1 text-[10px] font-bold text-[#cbb19b]">current</span></div><p className="mt-3 text-[11px] leading-5 text-[#dbc7b6]">{effectiveLabel}</p><div className="mt-5 border-t border-white/10 pt-4"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#c7a990]">AI original</p><div className="mt-2 flex items-center justify-between"><span className="text-xs font-extrabold capitalize text-[#fff9f0]">{candidate.aiRisk} risk</span>{candidate.overrideReason ? <span className="rounded-md bg-white/10 px-2 py-1 text-[9px] font-bold text-[#dbc7b6]">overridden</span> : null}</div></div><button onClick={() => setOverrideOpen(true)} className="focus-ring mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 px-3 py-2.5 text-[11px] font-extrabold text-[#fff9f0] outline-none hover:border-[#f5a074] hover:bg-white/5"><Pencil size={13} /> Override risk</button></div></div><div className="flex flex-col gap-3 border-t border-[#eee2d3] bg-[#f8f1e6] px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8"><div className="flex items-center gap-3"><div className="flex -space-x-2"><Avatar initials={candidate.recruiterInitials} tone="cocoa" size="sm" /><Avatar initials="AI" tone="orange" size="sm" /></div><p className="text-[11px] font-semibold text-[#806350]">Owned by <span className="font-extrabold text-[#4a3428]">{candidate.recruiter}</span> · assisted by HQ AI</p></div><div className="flex items-center gap-2 text-[10px] font-semibold text-[#9c7d67]"><ShieldCheck size={14} className="text-[#6b906d]" /> Last reviewed today</div></div></section>

    <section className="reveal-up reveal-up-delay-1 rounded-[22px] border border-[#eadcca] bg-[#fbf7f0] p-5 shadow-[0_12px_30px_rgba(91,57,36,0.05)] sm:p-7"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><SectionLabel>Service line</SectionLabel><h3 className="display-face mt-2 text-[27px] leading-none text-[#3c2920]">Journey to joining day</h3><p className="mt-2 text-xs font-medium text-[#a38570]">{completedCount} of 6 steps complete · {overdueCount} overdue</p></div><div className="flex items-center gap-2 rounded-xl bg-[#f3eadf] px-3 py-2"><div className="flex w-24 gap-1">{candidate.steps.map((step) => <span key={step.key} className={cn("h-1.5 flex-1 rounded-full", step.status === "completed" ? "bg-[#f56a2a]" : step.status === "overdue" ? "bg-[#d8593d]" : "bg-[#dfcfbd]")} />)}</div><span className="font-mono text-[10px] font-bold text-[#90715e]">{Math.round(completedCount / 6 * 100)}%</span></div></div><div className="mt-8 grid gap-3 md:grid-cols-6">{candidate.steps.map((step, index) => <JourneyNode key={step.key} step={step} index={index} onToggle={() => toggleStep(step.key)} />)}</div></section>

    <div className="grid gap-7 xl:grid-cols-[1.05fr_0.95fr]">
      <section className="reveal-up reveal-up-delay-2 rounded-[22px] border border-[#eadcca] bg-[#fbf7f0] p-5 shadow-[0_12px_30px_rgba(91,57,36,0.05)] sm:p-7">
        <div className="flex items-start justify-between gap-3"><div><SectionLabel>AI signal room</SectionLabel><h3 className="display-face mt-2 text-[27px] leading-none text-[#3c2920]">What to keep warm</h3></div><PendingButton pending={regenerating} onClick={regenerate} className="focus-ring rounded-xl border border-[#e4d5c3] bg-[#f7efe5] px-3 py-2 text-[10px] font-extrabold text-[#815f48] outline-none hover:border-[#f2a174] hover:text-[#f56a2a]"><RefreshCw size={13} /> Regenerate</PendingButton></div>
        <div className="mt-5 rounded-[18px] bg-[#f5eadc] p-4"><div className="flex items-center gap-2"><Sparkles size={14} className="text-[#f56a2a]" /><p className="text-xs font-extrabold text-[#4a3428]">Risk summary</p></div><p className="mt-3 text-sm leading-6 text-[#634737]">{aiAnalysis?.summary ?? "Run an AI briefing to summarize the recorded candidate interactions and highlight the next best touch."}</p><div className="mt-4 flex flex-wrap items-center gap-2">{aiAnalysis ? <LiveAIBadge /> : <span className="rounded-md bg-[#f4e8d7] px-1.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-[#a06a4c]">Ready to analyze</span>}<span className="font-mono text-[9px] font-bold text-[#a38670]">{aiAnalysis?.model ?? "HQ AI"} · {lastAIRefresh}</span></div></div>
        <div className="mt-6"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#a98a74]">Evidence signals</p>{aiAnalysis?.evidence.length ? <div className="mt-3 space-y-3">{aiAnalysis.evidence.map((signal, index) => <Signal key={`${signal.category}-${index}`} category={signal.category} severity={signal.severity} quote={signal.quote} />)}</div> : <p className="mt-3 text-xs leading-5 text-[#a38570]">No live evidence yet. The AI will cite only quoted interaction text.</p>}</div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="rounded-[16px] border border-[#eadcca] bg-[#fffaf3] p-4"><p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#a98a74]">Confidence & limits</p><p className="mt-2 text-xs leading-5 text-[#634737]">{aiAnalysis ? `${Math.round(aiAnalysis.confidence * 100)}% confidence · ${aiAnalysis.limitations[0]}` : "AI output stays advisory. A recruiter reviews every recommendation before acting."}</p></div><div className="rounded-[16px] border border-[#f0d5c1] bg-[#fff4eb] p-4"><p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#b96f48]">Recommended next</p><p className="mt-2 text-xs font-extrabold leading-5 text-[#7c442a]">{aiAnalysis?.recommended_action ?? candidate.nextAction}</p></div></div>
      </section>

      <section className="reveal-up reveal-up-delay-3 rounded-[22px] border border-[#eadcca] bg-[#fbf7f0] p-5 shadow-[0_12px_30px_rgba(91,57,36,0.05)] sm:p-7"><div className="flex items-start justify-between gap-3"><div><SectionLabel>Conversation log</SectionLabel><h3 className="display-face mt-2 text-[27px] leading-none text-[#3c2920]">Last touches</h3></div><span className="rounded-full bg-[#f3eadf] px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-[#9e7f68]">{interactions.length} logged</span></div><div className="mt-6 space-y-5">{interactions.map((interaction) => <div key={interaction.id} className="relative pl-8"><span className={cn("absolute left-0 top-1 flex h-5 w-5 items-center justify-center rounded-full", interaction.direction === "out" ? "bg-[#f8d5be] text-[#a15028]" : "bg-[#dbe8d6] text-[#5b7d5c]")}>{interaction.channel === "Email" ? <Mail size={10} /> : interaction.channel === "Note" ? <FileText size={10} /> : <MessageCircle size={10} />}</span><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-extrabold text-[#5b4030]">{interaction.channel} · {interaction.direction === "out" ? "You" : candidate.name.split(" ")[0]}</span><span className="text-[10px] text-[#ae917c]">{interaction.timestamp}</span></div><p className="mt-1.5 text-xs leading-5 text-[#725744]">{interaction.text}</p><p className="mt-1 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-[#b59884]">{interaction.tone}</p></div>)}</div><div className="mt-6 border-t border-[#eee2d3] pt-5"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#a98a74]">Add a manual log</p><div className="mt-3 flex gap-2"><input value={manualMessage} onChange={(event) => setManualMessage(event.target.value)} placeholder="e.g. Spoke and confirmed move" className="focus-ring min-w-0 flex-1 rounded-xl border border-[#e4d5c3] bg-[#fffaf3] px-3 py-2.5 text-xs font-semibold text-[#4a3428] outline-none placeholder:text-[#bd9f8a]" /><button onClick={addManualInteraction} className="focus-ring rounded-xl bg-[#3c2920] px-3 py-2.5 text-xs font-extrabold text-[#fff9f0] outline-none hover:bg-[#51382b]"><Send size={14} /></button></div></div></section>
    </div>

    <section className="reveal-up reveal-up-delay-4 rounded-[22px] border border-[#efcfb8] bg-[#fff7ef] p-5 shadow-[0_14px_32px_rgba(245,106,42,0.07)] sm:p-7"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#f9d7bf] text-[#f56a2a]"><Sparkles size={15} /></span><div><SectionLabel>Chat with AI assist</SectionLabel><h3 className="display-face mt-2 text-[27px] leading-none text-[#3c2920]">Make the next touch count</h3></div></div><p className="mt-3 max-w-xl text-xs leading-5 text-[#886b57]">Draft a personalized message using real candidate context. Choose a tone before generating; sending is simulated and only writes to this conversation log.</p></div><FallbackBadge /></div><div className="mt-6 grid gap-3 lg:grid-cols-[150px_150px_1fr_auto] lg:items-end"><label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.12em] text-[#ae8f78]">Channel</span><select value={composer.channel} onChange={(event) => setComposer((current) => ({ ...current, channel: event.target.value }))} className="focus-ring w-full rounded-xl border border-[#ead0bc] bg-[#fffaf3] px-3 py-2.5 text-xs font-bold text-[#624534] outline-none"><option>WhatsApp</option><option>Email</option></select></label><label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.12em] text-[#ae8f78]">Tone</span><select value={composer.tone} onChange={(event) => setComposer((current) => ({ ...current, tone: event.target.value as MessageTone }))} className="focus-ring w-full rounded-xl border border-[#ead0bc] bg-[#fffaf3] px-3 py-2.5 text-xs font-bold text-[#624534] outline-none"><option>Friendly</option><option>Formal</option><option>Urgent</option></select></label><label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.12em] text-[#ae8f78]">Draft message</span><textarea value={composer.draft} onChange={(event) => setComposer((current) => ({ ...current, draft: event.target.value }))} rows={3} placeholder="Generate a message grounded in this candidate's journey…" className="focus-ring w-full resize-none rounded-xl border border-[#ead0bc] bg-[#fffaf3] px-3 py-2.5 text-xs font-semibold leading-5 text-[#624534] outline-none placeholder:text-[#c09f88]" /></label><div className="flex gap-2 lg:flex-col"><PendingButton pending={generating} onClick={generateDraft} className="focus-ring rounded-xl bg-[#3c2920] px-4 py-2.5 text-[11px] font-extrabold text-[#fff9f0] outline-none hover:bg-[#51382b]"><Sparkles size={13} /> Generate</PendingButton><button onClick={sendDraft} className="focus-ring rounded-xl border border-[#e6b893] bg-[#f56a2a] px-4 py-2.5 text-[11px] font-extrabold text-white outline-none hover:bg-[#df571e]"><Send size={13} /></button></div></div><div className="mt-4 flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-[#b3927a]"><ShieldCheck size={13} className="text-[#6b906d]" /> AI assist uses candidate context · simulated sending only · draft model: hq-writer-v1</div></section>

    {overrideOpen ? <OverrideModal current={candidate.risk} onClose={() => setOverrideOpen(false)} onSave={saveRiskOverride} /> : null}
  </div>;
}

function InfoStat({ label, value, helper, icon: Icon, highlight = false }: { label: string; value: string; helper?: string; icon: React.ElementType; highlight?: boolean }) { return <div className={cn("rounded-[16px] border border-[#eadcca] bg-[#fffaf3] p-3.5", highlight && "border-[#efc5a9] bg-[#fff1e7]")}><div className="flex items-center gap-2 text-[#aa8c76]"><Icon size={14} /><span className="text-[10px] font-bold uppercase tracking-[0.1em]">{label}</span></div><p className={cn("mt-2 text-sm font-extrabold", highlight ? "text-[#b44831]" : "text-[#4a3428]")}>{value}</p>{helper ? <p className="mt-1 text-[10px] font-semibold text-[#a38570]">{helper}</p> : null}</div>; }

function JourneyNode({ step, index, onToggle }: { step: Candidate["steps"][number]; index: number; onToggle: () => void }) { const completed = step.status === "completed"; const overdue = step.status === "overdue"; return <button onClick={onToggle} className="focus-ring group relative text-left outline-none"><div className="mb-3 flex items-center gap-2"><span className={cn("flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-extrabold transition-transform group-hover:scale-105", completed ? "border-[#f56a2a] bg-[#f56a2a] text-white" : overdue ? "border-[#d8593d] bg-[#fff0eb] text-[#d8593d]" : "border-[#dfcfbd] bg-[#fffaf3] text-[#a88a74]")}>{completed ? <Check size={14} /> : index + 1}</span><span className={cn("hidden h-px flex-1 md:block", index < 5 ? "bg-[#e5d6c4]" : "bg-transparent")} /></div><p className="text-[11px] font-extrabold leading-4 text-[#5b4030] group-hover:text-[#f56a2a]">{step.label}</p><p className={cn("mt-1 text-[10px] font-bold", overdue ? "text-[#b44831]" : completed ? "text-[#668169]" : "text-[#aa8b75]")}>{overdue ? "Overdue" : completed ? "Complete" : `Due ${step.due}`}</p></button>; }

function Signal({ category, severity, quote }: { category: string; severity: RiskLevel; quote: string }) { return <div className="flex gap-3 rounded-[15px] border border-[#eee1d1] bg-[#fffaf3] p-3"><span className={cn("mt-0.5 h-2 w-2 shrink-0 rounded-full", severity === "high" ? "bg-[#d8593d]" : severity === "medium" ? "bg-[#e2ae48]" : "bg-[#6b906d]")} /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-[#a98a74]">{category}</span><span className="rounded bg-[#f2e7d9] px-1.5 py-0.5 text-[9px] font-bold capitalize text-[#876954]">{severity}</span></div><p className="mt-1 text-xs italic leading-5 text-[#725744]">“{quote}”</p></div></div>; }

function OverrideModal({ current, onClose, onSave }: { current: RiskLevel; onClose: () => void; onSave: (level: RiskLevel, reason: string) => void }) { const [level, setLevel] = useState<RiskLevel>(current); const [reason, setReason] = useState(""); return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#3c2920]/40 p-4 backdrop-blur-sm"><div role="dialog" aria-modal="true" className="w-full max-w-md rounded-[24px] border border-[#eadcca] bg-[#fbf7f0] p-6 shadow-[0_25px_80px_rgba(60,41,32,0.25)]"><div className="flex items-start justify-between"><div><SectionLabel>Human override</SectionLabel><h3 className="display-face mt-2 text-[28px] leading-none text-[#3c2920]">Add your read</h3></div><button onClick={onClose} aria-label="Close" className="focus-ring rounded-lg p-1 text-[#a78974] outline-none hover:bg-[#f1e5d8]"><X size={18} /></button></div><p className="mt-4 text-xs leading-5 text-[#806350]">The AI signal stays visible beside your call. Add the context a future teammate should trust.</p><div className="mt-6"><label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#a98a74]">New risk level</label><div className="mt-2 grid grid-cols-3 gap-2">{(["low", "medium", "high"] as RiskLevel[]).map((option) => <button key={option} onClick={() => setLevel(option)} className={cn("rounded-xl border px-3 py-2.5 text-xs font-extrabold capitalize", level === option ? "border-[#f56a2a] bg-[#fff0e6] text-[#c05225]" : "border-[#e5d6c4] text-[#92735e]")}>{option}</button>)}</div></div><label className="mt-5 block"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#a98a74]">Reason <span className="text-[#f56a2a]">*</span></span><textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} placeholder="What changed your view?" className="focus-ring mt-2 w-full resize-none rounded-xl border border-[#e5d6c4] bg-[#fffaf3] px-3 py-2.5 text-xs font-semibold leading-5 text-[#5b4030] outline-none placeholder:text-[#bda08b]" /></label><div className="mt-6 flex justify-end gap-2"><button onClick={onClose} className="focus-ring rounded-xl px-3.5 py-2.5 text-xs font-extrabold text-[#8b6d58] outline-none hover:bg-[#f1e5d8]">Cancel</button><button disabled={!reason.trim()} onClick={() => onSave(level, reason)} className="focus-ring rounded-xl bg-[#3c2920] px-4 py-2.5 text-xs font-extrabold text-[#fff9f0] outline-none hover:bg-[#51382b] disabled:cursor-not-allowed disabled:opacity-45">Save override</button></div></div></div>; }
