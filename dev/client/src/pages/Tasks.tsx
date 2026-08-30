/* Masala Ops task queue: a focused daily pass with automated engagement rules and recruiter actions. */
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  Clock3,
  Copy,
  Flame,
  ListChecks,
  Mail,
  MessageCircle,
  MessageSquare,
  Play,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  UserRound,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Avatar, PendingButton, SectionLabel } from "@/components/SharedPrimitives";
import { tasks as seedTasks } from "@/lib/mockData";
import {
  assignTask,
  completeTask,
  createManualInteraction,
  createWhatsAppDeepLink,
  dismissTask,
  EvaluateRulesResponse,
  fetchTasks,
  runEngagementRules,
  sendMessageToCandidate,
  type Task,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/contexts/NotificationContext";

const groupMeta = {
  Overdue: {
    icon: CircleAlert,
    color: "text-[#b44831]",
    bg: "bg-[#fff0eb]",
    description: "Needs a human nudge before it becomes a blocker.",
  },
  Today: {
    icon: Clock3,
    color: "text-[#a36c1d]",
    bg: "bg-[#fff6dd]",
    description: "The handful of actions that make today lighter.",
  },
  Upcoming: {
    icon: Sparkles,
    color: "text-[#5d7c60]",
    bg: "bg-[#edf6e9]",
    description: "Keep these in rhythm while the rest moves forward.",
  },
};

export default function Tasks() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [openTasks, setOpenTasks] = useState<Task[]>(seedTasks);
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [runningAutomation, setRunningAutomation] = useState(false);
  const [automationResult, setAutomationResult] = useState<EvaluateRulesResponse | null>(null);
  const { addNotification, refreshNotifications } = useNotifications();

  const loadTasks = async () => {
    try {
      setLoading(true);
      setError(false);
      const data = await fetchTasks("open");
      if (data && data.length > 0) {
        setOpenTasks(data);
      } else {
        setOpenTasks(seedTasks);
      }
    } catch {
      // Graceful fallback to seeded tasks if backend is offline
      setOpenTasks(seedTasks);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTasks();
  }, []);

  const grouped = useMemo(
    () =>
      (["Overdue", "Today", "Upcoming"] as const).map((group) => ({
        group,
        items: openTasks.filter((task) => task.dueGroup === group),
      })),
    [openTasks]
  );

  const handleComplete = async (id: string) => {
    setOpenTasks((current) => current.filter((task) => task.id !== id));
    try {
      await completeTask(id);
    } catch {
      // Local state already updated
    }
    toast.success("Task completed — candidate stays on track");
  };

  const handleDismiss = async (id: string) => {
    setOpenTasks((current) => current.filter((task) => task.id !== id));
    try {
      await dismissTask(id);
    } catch {
      // Local state already updated
    }
    toast("Task dismissed");
  };

  const handleAssign = async (task: Task) => {
    setOpenTasks((current) =>
      current.map((item) => (item.id === task.id ? { ...item, source: "human", assignedTo: "Nisha Rao" } : item))
    );
    try {
      await assignTask(task.id, "Nisha Rao");
    } catch {
      // Local state updated
    }
    addNotification({
      kind: "task",
      title: "Task assigned",
      body: `${task.action} for ${task.candidate} is now assigned to you.`,
    });
  };

  const handleRunAutomations = async () => {
    setRunningAutomation(true);
    try {
      const result = await runEngagementRules();
      setAutomationResult(result);
      setRulesModalOpen(true);
      await loadTasks();
      await refreshNotifications();
      if (result.flaggedCount > 0) {
        toast.success(`Automation evaluated: Flagged ${result.flaggedCount} candidate(s) & created ${result.tasksCreatedCount} task(s)!`, {
          description: result.summary,
        });
      } else {
        toast("Automation evaluated — all candidates are currently within safe engagement bounds.", {
          description: "No candidate is joining <= 7 days with >= 5 days of silence.",
        });
      }
    } catch {
      toast.error("Could not run automated rules on backend. Working in demo mode.");
    } finally {
      setRunningAutomation(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-7">
        <div className="h-36 animate-pulse rounded-[26px] bg-[#eadbca]" />
        <div className="grid gap-4 lg:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-72 animate-pulse rounded-[22px] bg-[#eadbca]" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[22px] border border-[#efbdb0] bg-[#fff0eb] p-8 text-center">
        <CircleAlert className="mx-auto text-[#b44831]" />
        <p className="mt-3 text-sm font-extrabold text-[#8d3f2b]">The task queue took a pause.</p>
        <button onClick={loadTasks} className="mt-4 text-xs font-extrabold text-[#b44831] underline underline-offset-4">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {/* Top Banner Hero */}
      <section className="reveal-up relative overflow-hidden rounded-[26px] bg-[#3c2920] p-6 text-[#fff9f0] shadow-[0_18px_42px_rgba(60,41,32,0.16)] sm:p-8">
        <div className="absolute -right-9 -top-12 h-48 w-48 rounded-full border-[18px] border-white/10" />
        <div className="absolute -bottom-20 right-20 h-48 w-48 rounded-full border-[1px] border-white/15" />
        <div className="relative z-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#ffe2d4]">
              <ListChecks size={14} /> The daily pass · Automated Ops
            </div>
            <h2 className="display-face mt-3 text-[34px] leading-none sm:text-[42px]">
              Do the next right thing<span className="text-[#f56a2a]">.</span>
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#fff0e7]">
              {openTasks.length} open actions across the roster. Active engagement rules continuously monitor silence and joining milestones to create proactive tasks.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#f56a2a] px-3 py-1.5 text-[10px] font-extrabold text-white">
                {grouped[0].items.length} overdue
              </span>
              <span className="rounded-full bg-white/15 px-3 py-1.5 text-[10px] font-extrabold">
                {grouped[1].items.length} due today
              </span>
              <span className="rounded-full bg-white/15 px-3 py-1.5 text-[10px] font-extrabold">
                {grouped[2].items.length} upcoming
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-950/40 px-3 py-1.5 text-[10px] font-extrabold text-emerald-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                1 Automated Rule Active
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row lg:flex-col shrink-0">
            <PendingButton
              pending={runningAutomation}
              onClick={handleRunAutomations}
              className="focus-ring inline-flex items-center justify-center gap-2 rounded-xl bg-[#f56a2a] px-4 py-3 text-xs font-extrabold text-white shadow-[0_8px_20px_rgba(245,106,42,0.3)] transition hover:bg-[#df571e] outline-none"
            >
              <Zap size={15} />
              Run Engagement Rules
            </PendingButton>

            <button
              onClick={() => setRulesModalOpen(true)}
              className="focus-ring inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-bold text-[#fff9f0] transition hover:bg-white/15 outline-none"
            >
              <Wand2 size={14} />
              Manage Engagement Rules
            </button>
          </div>
        </div>
      </section>

      {/* Task Columns */}
      <section className="grid gap-5 lg:grid-cols-3">
        {grouped.map(({ group, items }, index) => (
          <TaskGroup
            key={group}
            group={group}
            items={items}
            index={index}
            onComplete={handleComplete}
            onDismiss={handleDismiss}
            onAssign={handleAssign}
          />
        ))}
      </section>

      {/* Footer / Rule Summary Bar */}
      <div className="relative flex flex-col gap-3 overflow-hidden rounded-[20px] border border-[#eadcca] bg-[#fbf7f0] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fce5d8] text-[#f56a2a]">
            <Zap size={16} />
          </div>
          <div>
            <p className="text-xs font-extrabold text-[#4a3428]">
              Automated Engagement Rule: <span className="text-[#f56a2a]">Final-Stretch Silence Escalation</span>
            </p>
            <p className="mt-0.5 text-[11px] text-[#a38570]">
              Trigger: Joining date ≤ 7 days & last contact ≥ 5 days → Flags High Risk, auto-drafts check-in & creates HR task.
            </p>
          </div>
        </div>
        <button
          onClick={() => setRulesModalOpen(true)}
          className="focus-ring inline-flex items-center gap-1 self-start text-[11px] font-extrabold text-[#f56a2a] outline-none hover:underline"
        >
          View Rule Details & Execution Logs <ChevronRight size={14} />
        </button>
      </div>

      {/* Rules Modal */}
      {rulesModalOpen && (
        <AutomationRulesModal
          result={automationResult}
          running={runningAutomation}
          onRun={handleRunAutomations}
          onClose={() => setRulesModalOpen(false)}
        />
      )}
    </div>
  );
}

function TaskGroup({
  group,
  items,
  index,
  onComplete,
  onDismiss,
  onAssign,
}: {
  group: keyof typeof groupMeta;
  items: Task[];
  index: number;
  onComplete: (id: string) => void;
  onDismiss: (id: string) => void;
  onAssign: (task: Task) => void;
}) {
  const meta = groupMeta[group];
  const Icon = meta.icon;
  return (
    <section
      className={cn(
        "reveal-up rounded-[22px] border border-[#eadcca] bg-[#fbf7f0] p-5 shadow-[0_12px_30px_rgba(91,57,36,0.05)]",
        `reveal-up-delay-${index + 1}`
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl", meta.bg, meta.color)}>
              <Icon size={15} />
            </span>
            <h3 className="display-face text-[25px] leading-none text-[#3c2920]">{group}</h3>
          </div>
          <p className="mt-3 text-[11px] leading-5 text-[#a38570]">{meta.description}</p>
        </div>
        <span className={cn("rounded-full px-2 py-1 font-mono text-[9px] font-bold", meta.bg, meta.color)}>
          {items.length}
        </span>
      </div>
      <div className="mt-5 space-y-3">
        {items.length === 0 ? (
          <div className="rounded-[16px] border border-dashed border-[#e4d5c3] px-4 py-7 text-center">
            <p className="text-xs font-extrabold text-[#6a4b39]">Nothing here</p>
            <p className="mt-1 text-[10px] text-[#ad907b]">You have room for a good coffee.</p>
          </div>
        ) : (
          items.map((task) => (
            <TaskCard key={task.id} task={task} onComplete={onComplete} onDismiss={onDismiss} onAssign={onAssign} />
          ))
        )}
      </div>
    </section>
  );
}

function TaskCard({
  task,
  onComplete,
  onDismiss,
  onAssign,
}: {
  task: Task;
  onComplete: (id: string) => void;
  onDismiss: (id: string) => void;
  onAssign: (task: Task) => void;
}) {
  const [expandedDraft, setExpandedDraft] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);

  const isAutomation = task.source === "automation" || task.ruleName;
  const accent =
    isAutomation || task.accent === "tomato"
      ? "border-l-[#d8593d]"
      : task.accent === "orange"
      ? "border-l-[#f56a2a]"
      : "border-l-[#79a079]";

  const copyDraft = () => {
    if (task.suggestedMessage) {
      void navigator.clipboard.writeText(task.suggestedMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Draft copied to clipboard");
    }
  };

  const handleWhatsAppSend = async () => {
    if (!task.suggestedMessage) return;
    setSending(true);
    try {
      const res = await sendMessageToCandidate(task.candidateId, {
        channel: "WhatsApp",
        message: task.suggestedMessage,
        simulated: false,
      });
      const link = res.deepLink || createWhatsAppDeepLink("+919876543210", task.suggestedMessage);
      window.open(link, "_blank", "noopener,noreferrer");
      toast.success(`WhatsApp opened for ${task.candidate} & logged!`);
      onComplete(task.id);
    } catch {
      toast.error("Could not dispatch message via WhatsApp.");
    } finally {
      setSending(false);
    }
  };

  const handleSimulatedSend = async () => {
    if (!task.suggestedMessage) return;
    setSending(true);
    try {
      await sendMessageToCandidate(task.candidateId, {
        channel: "WhatsApp",
        message: task.suggestedMessage,
        simulated: true,
      });
      toast.success(`Check-in message logged for ${task.candidate}! (Simulated)`);
      onComplete(task.id);
    } catch {
      toast.error("Could not save interaction to database.");
    } finally {
      setSending(false);
    }
  };

  return (
    <article
      className={cn(
        "group rounded-[16px] border border-[#eee1d1] border-l-4 bg-[#fffaf3] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(91,57,36,0.07)]",
        accent
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar
          initials={
            task.candidateInitials ??
            task.candidate
              .split(" ")
              .map((part) => part[0])
              .join("")
          }
          tone={isAutomation || task.accent === "tomato" ? "orange" : task.accent === "sage" ? "sage" : "yellow"}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Link
              href={`/candidates/${task.candidateId}`}
              className="focus-ring text-xs font-extrabold text-[#4a3428] outline-none hover:text-[#f56a2a]"
            >
              {task.candidate}
            </Link>
            <span className="shrink-0 font-mono text-[9px] font-bold text-[#b0927c]">{task.dueLabel}</span>
          </div>

          <p className="mt-1.5 text-xs font-semibold leading-5 text-[#745744]">{task.action}</p>

          {isAutomation && (
            <div className="mt-2 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded bg-[#fcece6] px-1.5 py-0.5 font-mono text-[8.5px] font-bold uppercase tracking-[0.05em] text-[#d8593d]">
                <Zap size={10} /> Automated Escalation
              </span>
              {task.assignedTo && (
                <span className="font-mono text-[8.5px] text-[#9c7b64]">Assigned: {task.assignedTo}</span>
              )}
            </div>
          )}

          {/* Suggested Message Accordion */}
          {task.suggestedMessage && (
            <div className="mt-2.5 rounded-xl border border-[#ebd8c5] bg-[#fdf3e7] p-2.5 text-xs">
              <button
                onClick={() => setExpandedDraft(!expandedDraft)}
                className="flex w-full items-center justify-between font-mono text-[9.5px] font-bold uppercase tracking-[0.08em] text-[#ab6237] hover:text-[#f56a2a]"
              >
                <span className="flex items-center gap-1">
                  <Sparkles size={11} /> AI Draft Check-in Ready
                </span>
                {expandedDraft ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>

              {expandedDraft && (
                <div className="mt-2 border-t border-[#ebd8c5] pt-2">
                  <p className="text-[11.5px] italic leading-relaxed text-[#5b4030]">“{task.suggestedMessage}”</p>
                  <div className="mt-2.5 flex flex-wrap items-center justify-end gap-2">
                    <button
                      onClick={copyDraft}
                      className="focus-ring inline-flex items-center gap-1 rounded-lg border border-[#e4ccb5] bg-white px-2 py-1 text-[10px] font-bold text-[#745744] hover:bg-[#faf4ec]"
                    >
                      <Copy size={11} /> {copied ? "Copied" : "Copy"}
                    </button>
                    <button
                      disabled={sending}
                      onClick={handleWhatsAppSend}
                      className="focus-ring inline-flex items-center gap-1 rounded-lg border border-[#c3e3be] bg-[#25d366]/10 px-2 py-1 text-[10px] font-bold text-[#1f8846] hover:bg-[#25d366]/20 disabled:opacity-50"
                    >
                      <MessageCircle size={11} /> WhatsApp
                    </button>
                    <button
                      disabled={sending}
                      onClick={handleSimulatedSend}
                      className="focus-ring inline-flex items-center gap-1 rounded-lg bg-[#f56a2a] px-2.5 py-1 text-[10px] font-bold text-white hover:bg-[#df571e] disabled:opacity-50"
                    >
                      <Send size={11} /> {sending ? "Sending..." : "Simulate"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer Actions */}
          <div className="mt-3 flex items-center justify-between border-t border-[#eee1d1]/70 pt-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-[#f1e6d9] px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.06em] text-[#9c7b64]">
              {task.source === "automation" ? <Zap size={10} /> : <UserRound size={10} />} {task.source}
            </span>
            <div className="flex items-center gap-1">
              {task.source !== "human" && (
                <button
                  onClick={() => onAssign(task)}
                  title="Assign to me"
                  className="focus-ring rounded-lg p-1.5 text-[#a85c35] outline-none hover:bg-[#fff0e6]"
                >
                  <UserRound size={14} />
                </button>
              )}
              <button
                onClick={() => onComplete(task.id)}
                title="Mark complete"
                className="focus-ring rounded-lg p-1.5 text-[#67906b] outline-none hover:bg-[#e8f1e4]"
              >
                <Check size={14} />
              </button>
              <button
                onClick={() => onDismiss(task.id)}
                title="Dismiss task"
                className="focus-ring rounded-lg p-1.5 text-[#b99681] outline-none hover:bg-[#f6e8df]"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function AutomationRulesModal({
  result,
  running,
  onRun,
  onClose,
}: {
  result: EvaluateRulesResponse | null;
  running: boolean;
  onRun: () => Promise<void>;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#3c2920]/45 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[24px] border border-[#eadcca] bg-[#fbf7f0] p-6 shadow-[0_25px_80px_rgba(60,41,32,0.25)] sm:p-8"
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#fce8dc] text-[#f56a2a]">
                <Zap size={15} />
              </span>
              <SectionLabel>Automated Operations</SectionLabel>
            </div>
            <h3 className="display-face mt-2 text-[28px] leading-none text-[#3c2920]">Automated Engagement Rules</h3>
          </div>
          <button onClick={onClose} aria-label="Close" className="focus-ring rounded-lg p-1 text-[#a78974] outline-none hover:bg-[#f1e5d8]">
            <X size={18} />
          </button>
        </div>

        <p className="mt-3 text-xs leading-5 text-[#806350]">
          Configured rules run automatically to detect candidate disengagement early, generate context-grounded outreach messages, and open actionable recruiter tasks before joining day.
        </p>

        {/* Active Rule Card */}
        <div className="mt-6 rounded-[20px] border border-[#eed9c7] bg-[#fffaf3] p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <h4 className="text-sm font-extrabold text-[#4a3428]">Rule: Final-Stretch Silence Escalation</h4>
            </div>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-mono text-[9px] font-bold text-emerald-800">
              ACTIVE & ENFORCED
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-[#f7ede1] p-3">
              <p className="font-mono text-[9.5px] font-bold uppercase tracking-[0.1em] text-[#a06a4c]">Trigger Conditions</p>
              <ul className="mt-1.5 space-y-1 text-xs font-semibold text-[#634737]">
                <li className="flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-[#f56a2a]" /> Days to join ≤ 7 days
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-[#f56a2a]" /> Last interaction silence ≥ 5 days
                </li>
              </ul>
            </div>

            <div className="rounded-xl bg-[#f7ede1] p-3">
              <p className="font-mono text-[9.5px] font-bold uppercase tracking-[0.1em] text-[#a06a4c]">Automated Execution</p>
              <ul className="mt-1.5 space-y-1 text-xs font-semibold text-[#634737]">
                <li className="flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-[#d8593d]" /> Flag candidate & elevate to High Risk
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-[#f56a2a]" /> Generate personalized outreach message
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-[#5d7c60]" /> Create urgent task & recruiter notification
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Execution Log / Summary */}
        {result && (
          <div className="mt-6 space-y-3">
            <div className="rounded-[18px] border border-emerald-300 bg-emerald-50/70 p-4">
              <div className="flex items-center gap-2 text-emerald-800">
                <Check size={16} />
                <p className="text-xs font-extrabold">Rule Evaluation Summary</p>
              </div>
              <p className="mt-1.5 text-xs text-emerald-900">{result.summary}</p>
            </div>

            {result.flaggedCandidates.length > 0 ? (
              <div className="space-y-2">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[#a98a74]">
                  Flagged Candidates ({result.flaggedCandidates.length})
                </p>
                {result.flaggedCandidates.map((f) => (
                  <div key={f.candidateId} className="rounded-xl border border-[#eed9c7] bg-[#fffaf3] p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-[#4a3428]">{f.candidateName}</span>
                      <span className="font-mono text-[10px] text-[#b44831]">
                        Joining in {f.daysToJoin}d · {f.lastContactDays}d silent
                      </span>
                    </div>
                    <p className="mt-1.5 text-[11px] italic text-[#725744]">“{f.draftMessage}”</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}

        <div className="mt-7 flex items-center justify-between border-t border-[#eadcca] pt-4">
          <button
            onClick={onClose}
            className="focus-ring rounded-xl px-4 py-2.5 text-xs font-extrabold text-[#8b6d58] outline-none hover:bg-[#f1e5d8]"
          >
            Close
          </button>
          <PendingButton
            pending={running}
            onClick={onRun}
            className="focus-ring inline-flex items-center gap-2 rounded-xl bg-[#3c2920] px-4 py-2.5 text-xs font-extrabold text-[#fff9f0] outline-none hover:bg-[#51382b]"
          >
            <Play size={13} />
            Evaluate Rule Now
          </PendingButton>
        </div>
      </div>
    </div>
  );
}
