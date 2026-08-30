/* Masala Ops shell: persistent kitchen-pass navigation, warm surfaces, and a focused command header. */
import { useState } from "react";
import { Bell, BarChart3, ClipboardList, Command, HelpCircle, LayoutDashboard, Menu, Plus, Search, Settings2, Sparkles, UserRound, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/contexts/NotificationContext";

const navigation = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/tasks", label: "Task queue", icon: ClipboardList, count: 6 },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

function pageMeta(pathname: string) {
  if (pathname === "/tasks") return { eyebrow: "Recruiter workspace", title: "Task queue" };
  if (pathname === "/analytics") return { eyebrow: "Signal room", title: "Analytics" };
  if (pathname.startsWith("/candidates/")) return { eyebrow: "Candidate workspace", title: "Candidate detail" };
  return { eyebrow: "Recruiter workspace", title: "Offer desk" };
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [notificationOpen, setNotificationOpen] = useState(false);
  const { notifications, unreadCount, markAllRead } = useNotifications();
  const meta = pageMeta(location);

  return (
    <div className="min-h-screen bg-[#f5efe4] text-[#3c2920]">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside className="app-rail flex shrink-0 flex-col border-b border-[#e7d8c5] bg-[#f8f3ea] px-4 py-4 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
          <div className="flex items-center justify-between gap-3 lg:block">
            <Link href="/" className="focus-ring inline-flex items-center gap-3 rounded-xl outline-none">
              <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#f56a2a] shadow-[0_8px_18px_rgba(245,106,42,0.22)]">
                <img
                  src="/assets/post-offer-mark_787b2c60.webp"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (!target.src.endsWith(".png")) {
                      target.src = "/assets/post-offer-mark_787b2c60.png";
                    } else {
                      target.style.display = "none";
                    }
                  }}
                  alt="Post-Offer HQ"
                  className="h-7 w-7 object-contain"
                />
              </span>
              <span className="hidden lg:block">
                <span className="display-face block text-[19px] leading-none text-[#3c2920]">post-offer</span>
                <span className="mt-1 block font-mono text-[9px] font-bold uppercase tracking-[0.24em] text-[#a06a4c]">HQ / 26.08</span>
              </span>
            </Link>
            <button aria-label="Open menu" className="focus-ring pressable rounded-xl border border-[#e7d8c5] p-2 text-[#7d604e] lg:hidden" onClick={() => toast("Navigation is available below on small screens") }>
              <Menu size={18} />
            </button>
          </div>

          <div className="mt-8 hidden lg:block">
            <div className="mb-3 px-3 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#b3947d]">The pass</div>
            <nav className="space-y-1.5" aria-label="Primary navigation">
              {navigation.map((item) => {
                const active = item.href === "/" ? location === "/" : location.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} className={cn("focus-ring group flex items-center justify-between rounded-2xl px-3 py-3 text-sm font-semibold outline-none transition-all duration-200", active ? "bg-[#3c2920] text-[#fff9f0] shadow-[0_12px_26px_rgba(60,41,32,0.14)]" : "text-[#806956] hover:bg-[#efe4d5] hover:text-[#3c2920]")}>
                    <span className="flex items-center gap-3">
                      <Icon size={17} strokeWidth={active ? 2.4 : 1.8} />
                      {item.label}
                    </span>
                    {item.count ? <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", active ? "bg-[#f56a2a] text-white" : "bg-[#f1d2b8] text-[#a04d22]")}>{item.count}</span> : null}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="mt-auto hidden lg:block">
            <div className="mb-5 rounded-[22px] border border-[#ead7c2] bg-[#fff9f0] p-4 shadow-[0_10px_24px_rgba(95,58,36,0.05)]">
              <div className="flex items-center gap-2 text-[#f56a2a]"><Sparkles size={15} fill="currentColor" /><span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em]">Briefing note</span></div>
              <p className="mt-3 text-[13px] leading-5 text-[#735846]">Two joiners are inside their final week. Keep the handoff warm.</p>
              <button onClick={() => toast("Briefing refreshed — no new blockers") } className="focus-ring mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#3c2920] underline decoration-[#e4a37a] underline-offset-4">Refresh brief <Plus size={13} /></button>
            </div>
            <nav className="space-y-1" aria-label="Utility navigation">
              <button onClick={() => toast("Help centre is coming soon") } className="focus-ring flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#806956] outline-none hover:bg-[#efe4d5] hover:text-[#3c2920]"><HelpCircle size={16} /> Help centre</button>
              <button onClick={() => toast("Settings are coming soon") } className="focus-ring flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#806956] outline-none hover:bg-[#efe4d5] hover:text-[#3c2920]"><Settings2 size={16} /> Settings</button>
            </nav>
            <div className="mt-6 flex items-center gap-3 border-t border-[#e7d8c5] pt-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#dbe8d6] text-xs font-extrabold text-[#466649]">NR</div>
              <div className="min-w-0 flex-1"><p className="truncate text-xs font-extrabold text-[#3c2920]">Nisha Rao</p><p className="mt-0.5 text-[10px] font-medium text-[#9b7c66]">People operations</p></div>
              <button aria-label="Account menu" onClick={() => toast("Account menu is coming soon") } className="focus-ring rounded-lg p-1 text-[#a98a74] outline-none hover:bg-[#efe4d5] hover:text-[#3c2920]"><UserRound size={15} /></button>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-[#eadbca]/90 bg-[#f5efe4]/95 backdrop-blur-xl">
            <div className="container flex h-[76px] items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#b3947d]">{meta.eyebrow}</p>
                <div className="mt-1 flex items-center gap-2"><h1 className="display-face truncate text-[25px] leading-none text-[#3c2920]">{meta.title}</h1><span className="hidden h-1.5 w-1.5 rounded-full bg-[#f56a2a] sm:block" /></div>
              </div>
              <div className="flex items-center gap-2.5">
                <label className="focus-within:ring-3 hidden items-center gap-2 rounded-xl border border-[#e4d5c3] bg-[#fbf7f0] px-3 py-2 text-[#a88974] transition focus-within:border-[#f2a174] focus-within:ring-[#f5a074]/20 sm:flex">
                  <Search size={15} />
                  <input className="w-32 bg-transparent text-xs font-semibold text-[#4a3428] outline-none placeholder:text-[#bca18f]" placeholder="Search people" aria-label="Search people" />
                  <span className="ml-2 inline-flex items-center gap-1 rounded-md bg-[#f1e5d8] px-1.5 py-0.5 font-mono text-[9px] text-[#9a7a62]"><Command size={9} /> K</span>
                </label>
                <div className="relative"><button aria-label="Notifications" onClick={() => { setNotificationOpen((open) => !open); markAllRead(); }} className="focus-ring pressable relative rounded-xl border border-[#e4d5c3] bg-[#fbf7f0] p-2.5 text-[#846754] outline-none hover:border-[#f2a174] hover:text-[#f56a2a]"><Bell size={17} />{unreadCount > 0 ? <span className="absolute right-1.5 top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[#f56a2a] px-1 text-[8px] font-extrabold text-white">{unreadCount}</span> : null}</button>{notificationOpen ? <div className="absolute right-0 top-12 z-50 w-[300px] rounded-2xl border border-[#eadcca] bg-[#fffaf3] p-3 shadow-[0_18px_44px_rgba(60,41,32,0.16)]"><div className="flex items-center justify-between border-b border-[#eee1d1] px-2 pb-3"><div><p className="font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-[#b3947d]">Live desk</p><p className="mt-1 text-xs font-extrabold text-[#4a3428]">Recruiter notifications</p></div><button aria-label="Close notifications" onClick={() => setNotificationOpen(false)} className="rounded-lg p-1 text-[#a98a74] hover:bg-[#f3eadf]"><X size={14} /></button></div><div className="max-h-64 space-y-2 overflow-auto py-2">{notifications.length ? notifications.map((item) => <div key={item.id} className="rounded-xl bg-[#f6ede2] p-3"><div className="flex items-center justify-between gap-2"><p className="text-[11px] font-extrabold text-[#5b4030]">{item.title}</p><span className="font-mono text-[9px] text-[#b0927c]">{item.createdAt}</span></div><p className="mt-1 text-[10px] leading-4 text-[#876954]">{item.body}</p></div>) : <p className="px-2 py-5 text-center text-xs text-[#a38570]">You are all caught up.</p>}</div></div> : null}</div>
                <button onClick={() => toast("Create flow is coming soon") } className="focus-ring pressable hidden items-center gap-2 rounded-xl bg-[#f56a2a] px-3.5 py-2.5 text-xs font-extrabold text-white shadow-[0_8px_18px_rgba(245,106,42,0.2)] outline-none hover:bg-[#df571e] sm:inline-flex"><Plus size={15} /> Add candidate</button>
              </div>
            </div>
          </header>
          <div className="container py-7 pb-14 lg:py-9">{children}</div>
        </main>
      </div>
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-[#e7d8c5] bg-[#fbf7f0]/95 px-3 py-2 backdrop-blur-xl lg:hidden" aria-label="Mobile navigation">
        {navigation.map((item) => { const active = item.href === "/" ? location === "/" : location.startsWith(item.href); const Icon = item.icon; return <Link key={item.href} href={item.href} className={cn("focus-ring flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-bold outline-none", active ? "text-[#f56a2a]" : "text-[#9b7c66]")}><Icon size={18} /><span>{item.label}</span></Link>; })}
      </nav>
    </div>
  );
}
