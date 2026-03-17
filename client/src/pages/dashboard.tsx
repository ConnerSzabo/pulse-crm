import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Building2, CalendarDays, ListTodo, Users, Clock, ArrowRight, MapPin } from "lucide-react";
import { format } from "date-fns";
import type { Show } from "@shared/schema";

const SHOW_STATUS_STYLES: Record<string, string> = {
  "Contacted":       "bg-blue-500/20 text-blue-300 border border-blue-500/30",
  "In Conversation": "bg-amber-500/20 text-amber-300 border border-amber-500/30",
  "Sponsoring":      "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
  "Confirmed":       "bg-purple-500/20 text-purple-300 border border-purple-500/30",
  "Completed":       "bg-slate-500/20 text-slate-400 border border-slate-500/30",
};

function StatCard({ title, value, icon: Icon, gradient, linkTo }: {
  title: string; value: number; icon: any; gradient: string; linkTo: string;
}) {
  return (
    <Link href={linkTo}>
      <div className={`rounded-2xl p-5 bg-gradient-to-br ${gradient} border border-white/10 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-white/60 text-xs font-medium uppercase tracking-wider mb-2">{title}</p>
            <p className="text-white text-4xl font-bold">{value}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<any>({ queryKey: ["/api/dashboard/stats"] });

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-7 bg-[#1a1f2e] rounded-lg w-48 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-[#1a1f2e] rounded-2xl animate-pulse" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => <div key={i} className="h-64 bg-[#1a1f2e] rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  const upcomingShows: Show[] = stats?.upcomingShows || [];
  const recentActivities: any[] = stats?.recentActivities || [];

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#f1f5f9]">Dashboard</h1>
        <p className="text-[#64748b] mt-1 text-sm">PokéPulse partnership pipeline overview</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="TSOs"       value={stats?.tsoCount ?? 0}     icon={Building2}    gradient="from-indigo-500 to-purple-600" linkTo="/tsos" />
        <StatCard title="Shows"      value={stats?.showCount ?? 0}     icon={CalendarDays} gradient="from-blue-500 to-cyan-600"     linkTo="/shows" />
        <StatCard title="Open Tasks" value={stats?.openTaskCount ?? 0} icon={ListTodo}     gradient="from-orange-500 to-amber-600"  linkTo="/tasks" />
        <StatCard title="Contacts"   value={stats?.contactCount ?? 0}  icon={Users}        gradient="from-emerald-500 to-green-600" linkTo="/contacts" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upcoming Shows */}
        <div className="rounded-2xl border border-[#2d3548] bg-[#1a1f2e]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#2d3548]">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-[#6366f1]" />
              <h2 className="text-sm font-semibold text-[#f1f5f9]">Upcoming Shows</h2>
            </div>
            <Link href="/shows">
              <span className="text-xs text-[#6366f1] hover:text-[#818cf8] flex items-center gap-1 transition-colors cursor-pointer">
                View all <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          </div>
          <div className="p-3 space-y-1">
            {upcomingShows.length === 0 ? (
              <p className="text-sm text-[#64748b] py-6 text-center">No upcoming shows</p>
            ) : upcomingShows.map(show => (
              <Link key={show.id} href={`/show/${show.id}`}>
                <div className="flex items-center justify-between p-3 rounded-xl hover:bg-[#6366f1]/5 border border-transparent hover:border-[#6366f1]/20 cursor-pointer transition-all">
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-[#f1f5f9] truncate">{show.showName}</p>
                    <p className="text-xs text-[#64748b] flex items-center gap-1 mt-0.5">
                      {show.city && <><MapPin className="h-3 w-3" />{show.city}</>}
                      {show.showDate && <> · {format(new Date(show.showDate), "d MMM yyyy")}</>}
                    </p>
                  </div>
                  {show.status && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-2 shrink-0 ${SHOW_STATUS_STYLES[show.status] || "bg-slate-500/20 text-slate-400"}`}>
                      {show.status}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-2xl border border-[#2d3548] bg-[#1a1f2e]">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-[#2d3548]">
            <Clock className="h-4 w-4 text-[#6366f1]" />
            <h2 className="text-sm font-semibold text-[#f1f5f9]">Recent Activity</h2>
          </div>
          <div className="p-3 space-y-0.5">
            {recentActivities.length === 0 ? (
              <p className="text-sm text-[#64748b] py-6 text-center">No recent activity</p>
            ) : recentActivities.slice(0, 8).map((act: any) => (
              <div key={act.id} className="flex items-start gap-3 px-2 py-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                <span className="text-[#64748b] text-xs mt-0.5 shrink-0 w-12">{format(new Date(act.createdAt), "d MMM")}</span>
                <span className="text-xs font-semibold capitalize text-[#818cf8] shrink-0 w-16">{act.type}</span>
                <span className="text-xs text-[#94a3b8] truncate">{act.note}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
