import { useEffect, useState } from "react";
import { ArrowDownUp, ArrowUpRight, CalendarDays, Check, ChevronDown, Clock3, Filter, MapPin, Search, SlidersHorizontal, Sparkles, UsersRound, Zap } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { Avatar, JourneyProgress, PendingButton, RiskChip, SectionLabel } from "@/components/SharedPrimitives";
import { type Candidate } from "@/lib/mockData";
import { cn } from "@/lib/utils";
import { downloadCandidatesCsv } from "@/lib/csv";
import { fetchCandidates, runEngagementRules } from "@/lib/api";

const kpis = [
  { label: "Total offered", value: "48", helper: "+6 this month", icon: UsersRound, tone: "orange" },
  { label: "Joining in 7 days", value: "8", helper: "2 need attention", icon: CalendarDays, tone: "cocoa" },
  { label: "Joining in 15 days", value: "17", helper: "steady vs last week", icon: Clock3, tone: "sage" },
  { label: "High-risk", value: "6", helper: "3 silent for 5+ days", icon: Filter, tone: "tomato" },
  { label: "Offer → join rate", value: "76%", helper: "+4.2% this quarter", icon: Sparkles, tone: "yellow" },
] as const;

const toneMap = {
  orange: "bg-[#f8d5be] text-[#9d4d25]",
  cocoa: "bg-[#e5d9ca] text-[#745b48]",
  sage: "bg-[#dbe8d6] text-[#527055]",
  tomato: "bg-[#f4d4cd] text-[#aa4934]",
  yellow: "bg-[#f4e5b8] text-[#88661f]",
};

function SkeletonRows() {
  return <div className="space-y-3 p-5">{[1, 2, 3, 4, 5].map((row) => <div key={row} className="flex animate-pulse items-center gap-4 rounded-xl bg-[#f4eadc] p-4"><div className="h-9 w-9 rounded-full bg-[#eadbca]" /><div className="flex-1 space-y-2"><div className="h-3 w-36 rounded bg-[#eadbca]" /><div className="h-2.5 w-24 rounded bg-[#eadbca]" /></div><div className="hidden h-3 w-28 rounded bg-[#eadbca] sm:block" /><div className="h-3 w-16 rounded bg-[#eadbca]" /></div>)}</div>;
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get("q") ?? "");
  const [risk, setRisk] = useState(() => new URLSearchParams(window.location.search).get("risk") ?? "all");
  const [recruiter, setRecruiter] = useState(() => new URLSearchParams(window.location.search).get("recruiter") ?? "all");
  const [sort, setSort] = useState<"joining" | "risk">("joining");
  const [month, setMonth] = useState("all");
  const [records, setRecords] = useState<Candidate[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    void fetchCandidates({ search, risk, recruiter, month, page, pageSize: 12, sort }).then((result) => {
      if (!active) return;
      setRecords(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [month, page, recruiter, risk, search, sort]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (risk !== "all") params.set("risk", risk);
    if (recruiter !== "all") params.set("recruiter", recruiter);
    window.history.replaceState({}, "", params.toString() ? `/?${params.toString()}` : "/");
  }, [search, risk, recruiter]);

  const [runningRules, setRunningRules] = useState(false);

  const handleRunEngagementRules = async () => {
    setRunningRules(true);
    try {
      const res = await runEngagementRules();
      toast.success(res.summary);
      // Refresh candidate roster
      const result = await fetchCandidates({ search, risk, recruiter, month, page, pageSize: 12, sort });
      setRecords(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch {
      toast.error("Could not run automated rules on backend.");
    } finally {
      setRunningRules(false);
    }
  };

  const filtered = records;
  const clearFilters = () => { setSearch(""); setRisk("all"); setRecruiter("all"); setMonth("all"); setPage(1); toast("Filters cleared"); };
  const dashboardKpis = kpis.map((item) => item.label === "Total offered" ? { ...item, value: String(total), helper: "Active offers in SQLite" } : item.label === "High-risk" ? { ...item, value: String(filtered.filter((candidate) => candidate.risk === "high").length), helper: "On this page" } : item);

  return <div className="space-y-7">
    <section className="reveal-up relative overflow-hidden rounded-[26px] bg-[#3c2920] p-6 text-[#fff9f0] shadow-[0_20px_50px_rgba(60,41,32,0.16)] sm:p-8 lg:min-h-[220px] lg:p-10">
      <div className="absolute inset-y-0 right-0 hidden w-[48%] bg-[#f3dfc9] lg:block">
        <img
          src="/assets/post-offer-hero_0181dbd3.webp"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            if (!target.src.endsWith(".png")) {
              target.src = "/assets/post-offer-hero_0181dbd3.png";
            }
          }}
          alt="Abstract tiffin and candidate journey illustration"
          className="h-full w-full object-cover opacity-95"
        />
      </div>
      <div className="relative z-10 max-w-[540px]">
        <div className="mb-6 flex items-center gap-2"><span className="inline-flex items-center gap-2 rounded-full bg-[#f56a2a] px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-white"><span className="h-1.5 w-1.5 rounded-full bg-white" /> Live desk</span><span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#cfb7a1]">Thursday, 27 Aug 2026</span></div>
        <h2 className="display-face max-w-[450px] text-[36px] leading-[0.98] sm:text-[45px]">Keep good people warm<span className="text-[#f56a2a]">.</span></h2>
        <p className="mt-4 max-w-[450px] text-sm leading-6 text-[#ddcabb]">A calmer way to move every offer toward day one. Here is what needs your attention before the next handoff.</p>
        <div className="mt-7 flex items-center gap-4"><div className="flex -space-x-2">{filtered.slice(0, 4).map((candidate) => <Avatar key={candidate.id} initials={candidate.initials} tone={candidate.risk === "high" ? "orange" : "sage"} size="sm" />)}</div><div><p className="text-xs font-bold text-[#fff9f0]">{total} people in motion</p><p className="mt-0.5 text-[10px] text-[#c7ad98]">Live roster from SQLite</p></div></div>
      </div>
    </section>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {dashboardKpis.map((item, index) => { const Icon = item.icon; return <article key={item.label} className={cn("reveal-up rounded-[20px] border border-[#eadcca] bg-[#fbf7f0] p-4 shadow-[0_10px_28px_rgba(91,57,36,0.045)]", `reveal-up-delay-${Math.min(index + 1, 4)}`)}><div className="flex items-center justify-between"><span className={cn("flex h-8 w-8 items-center justify-center rounded-xl", toneMap[item.tone])}><Icon size={15} /></span>{index === 4 ? <span className="font-mono text-[9px] font-bold text-[#54805d]">+4.2%</span> : <ArrowUpRight size={14} className="text-[#c1a48e]" />}</div><p className="display-face mt-5 text-[34px] leading-none text-[#3c2920]">{item.value}</p><p className="mt-2 text-[11px] font-extrabold text-[#654939]">{item.label}</p><p className="mt-1 text-[10px] font-medium text-[#a38570]">{item.helper}</p></article>; })}
    </section>

    <section className="reveal-up reveal-up-delay-2 space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <SectionLabel>Candidate roster</SectionLabel>
          <h2 className="display-face mt-2 text-[28px] leading-none text-[#3c2920]">Everyone, at a glance</h2>
        </div>
        <div className="flex items-center gap-2">
          <PendingButton pending={runningRules} onClick={handleRunEngagementRules} className="focus-ring inline-flex items-center gap-1.5 rounded-xl bg-[#f56a2a] px-3 py-2 text-[11px] font-extrabold text-white shadow-sm hover:bg-[#df571e]">
            <Zap size={13} /> Run Rule Check
          </PendingButton>
          <button onClick={() => { downloadCandidatesCsv(filtered); toast(`${filtered.length} candidate${filtered.length === 1 ? "" : "s"} exported as CSV`); }} className="focus-ring inline-flex items-center gap-2 self-start rounded-xl border border-[#dfcfbd] bg-[#fbf7f0] px-3 py-2 text-[11px] font-extrabold text-[#735846] outline-none hover:border-[#f2a174] hover:text-[#f56a2a]">
            <ArrowDownUp size={14} /> Export view
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-3 rounded-[20px] border border-[#eadcca] bg-[#fbf7f0] p-3 shadow-[0_12px_30px_rgba(91,57,36,0.045)] xl:flex-row xl:items-center"><label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-[#f3eadf] px-3 py-2.5 text-[#a78974] focus-within:ring-2 focus-within:ring-[#f5a074]/30"><Search size={15} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-[#4b3428] outline-none placeholder:text-[#ad927e]" placeholder="Search by name, role, or city" aria-label="Search candidates" /></label><div className="flex flex-wrap items-center gap-2"><select value={month} onChange={(event) => { setMonth(event.target.value); setPage(1); }} className="focus-ring rounded-xl bg-[#f3eadf] px-3 py-2.5 text-[11px] font-bold text-[#735846] outline-none"><option value="all">All joining months</option><option value="Aug">August joins</option><option value="Sep">September joins</option></select><select value={recruiter} onChange={(event) => { setRecruiter(event.target.value); setPage(1); }} className="focus-ring rounded-xl bg-[#f3eadf] px-3 py-2.5 text-[11px] font-bold text-[#735846] outline-none"><option value="all">All recruiters</option><option value="Nisha Rao">Nisha Rao</option><option value="Kabir Menon">Kabir Menon</option><option value="Sana Kapoor">Sana Kapoor</option></select><select value={risk} onChange={(event) => { setRisk(event.target.value); setPage(1); }} className="focus-ring rounded-xl bg-[#f3eadf] px-3 py-2.5 text-[11px] font-bold capitalize text-[#735846] outline-none"><option value="all">All risk levels</option><option value="low">Low risk</option><option value="medium">Medium risk</option><option value="high">High risk</option></select><button onClick={clearFilters} className="focus-ring rounded-xl px-3 py-2.5 text-[11px] font-extrabold text-[#b06b47] outline-none hover:bg-[#fae3d3]">Reset</button></div></div>
    </section>

    <section className="overflow-hidden rounded-[22px] border border-[#eadcca] bg-[#fbf7f0] shadow-[0_16px_34px_rgba(91,57,36,0.06)]">
      <div className="flex flex-col justify-between gap-3 border-b border-[#eee2d3] px-5 py-4 sm:flex-row sm:items-center"><div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#f9dfcb] text-[#f56a2a]"><UsersRound size={15} /></span><div><p className="text-xs font-extrabold text-[#4a3428]">Active offers</p><p className="mt-0.5 text-[10px] font-medium text-[#aa8b75]">{filtered.length} of {total} people showing</p></div></div><div className="flex items-center gap-1 rounded-xl bg-[#f3eadf] p-1"><button onClick={() => { setSort("joining"); setPage(1); }} className={cn("rounded-lg px-2.5 py-1.5 text-[10px] font-extrabold", sort === "joining" ? "bg-[#fbf7f0] text-[#3c2920] shadow-sm" : "text-[#a38570]")}>Soonest first</button><button onClick={() => { setSort("risk"); setPage(1); }} className={cn("rounded-lg px-2.5 py-1.5 text-[10px] font-extrabold", sort === "risk" ? "bg-[#fbf7f0] text-[#3c2920] shadow-sm" : "text-[#a38570]")}>Risk first</button></div></div>
      {error ? <div className="m-5 flex items-center justify-between rounded-xl border border-[#efbdb0] bg-[#fff0eb] px-4 py-3 text-xs text-[#a6442e]"><span>We could not load the roster just now.</span><button onClick={() => { setError(false); setLoading(true); window.setTimeout(() => setLoading(false), 600); }} className="font-extrabold underline underline-offset-4">Retry</button></div> : loading ? <SkeletonRows /> : filtered.length === 0 ? <div className="px-5 py-16 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f3eadf] text-[#b18e74]"><SlidersHorizontal size={19} /></div><p className="mt-4 text-sm font-extrabold text-[#4a3428]">No one matches this view</p><p className="mt-1 text-xs text-[#a38570]">Try loosening a filter or search a different name.</p><button onClick={clearFilters} className="mt-4 text-xs font-extrabold text-[#f56a2a] underline underline-offset-4">Clear filters</button></div> : <div className="overflow-x-auto"><table className="w-full min-w-[930px] border-collapse text-left"><thead><tr className="border-b border-[#eee2d3] font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-[#ad907b]"><th className="px-5 py-3.5">Candidate</th><th className="px-4 py-3.5">Joining</th><th className="px-4 py-3.5">Journey</th><th className="px-4 py-3.5">Last contact</th><th className="px-4 py-3.5">Risk</th><th className="px-5 py-3.5">Next recommended action</th></tr></thead><tbody>{filtered.map((candidate) => <CandidateRow key={candidate.id} candidate={candidate} onNavigate={() => navigate(`/candidates/${candidate.id}`)} />)}</tbody></table></div>}
    </section>
    <div className="flex items-center justify-between px-1"><p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#ae917c]">Page {page} of {totalPages} · {total} records</p><div className="flex items-center gap-2"><button disabled={page === 1} onClick={() => setPage((current) => current - 1)} className="focus-ring rounded-lg px-2 py-1 text-[11px] font-extrabold text-[#785b48] outline-none disabled:opacity-40 hover:text-[#f56a2a]">Previous</button><button disabled={page === totalPages} onClick={() => setPage((current) => current + 1)} className="focus-ring inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-extrabold text-[#785b48] outline-none disabled:opacity-40 hover:text-[#f56a2a]">Next <ChevronDown size={14} /></button></div></div>
  </div>;
}

function CandidateRow({ candidate, onNavigate }: { candidate: Candidate; onNavigate: () => void }) {
  const silenceClass = candidate.lastContactDays >= 10 ? "text-[#b44831]" : candidate.lastContactDays >= 5 ? "text-[#a36c1d]" : "text-[#678268]";
  const silenceLabel = candidate.lastContactDays === 1 ? "Yesterday" : `${candidate.lastContactDays} days ago`;
  return <tr onClick={onNavigate} onKeyDown={(event) => { if (event.key === "Enter") onNavigate(); }} tabIndex={0} className="group cursor-pointer border-b border-[#f0e6da] align-middle transition-colors last:border-0 hover:bg-[#fffaf3] focus:bg-[#fffaf3] focus:outline-none"><td className="px-5 py-4"><div className="flex items-center gap-3"><Avatar initials={candidate.initials} tone={candidate.risk === "high" ? "orange" : candidate.department === "Engineering" ? "cocoa" : "sage"} /><div><Link href={`/candidates/${candidate.id}`} onClick={(event) => event.stopPropagation()} className="focus-ring text-xs font-extrabold text-[#4a3428] outline-none group-hover:text-[#f56a2a]">{candidate.name}</Link><p className="mt-1 text-[10px] font-medium text-[#a38570]">{candidate.role} · {candidate.location}</p></div></div></td><td className="px-4 py-4"><p className="text-xs font-extrabold text-[#4a3428]">{candidate.joiningDayLabel}</p><p className={cn("mt-1 text-[10px] font-bold", candidate.daysToJoin <= 7 ? "text-[#b44831]" : "text-[#a38570]")}>{candidate.daysToJoin} days to join</p></td><td className="px-4 py-4"><JourneyProgress steps={candidate.steps} showLabel /></td><td className="px-4 py-4"><p className={cn("text-[11px] font-extrabold", silenceClass)}>{silenceLabel}</p><p className="mt-1 text-[10px] text-[#aa8b75]">{candidate.lastContactDays >= 5 ? "Needs a touch" : "In rhythm"}</p></td><td className="px-4 py-4"><RiskChip risk={candidate.risk} overridden={candidate.aiRisk !== candidate.risk} /></td><td className="px-5 py-4"><div className="flex max-w-[220px] items-center justify-between gap-3"><p className="text-[11px] font-semibold leading-4 text-[#735846]">{candidate.nextAction}</p><ArrowUpRight size={14} className="shrink-0 text-[#c49b7f] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></div></td></tr>;
}
