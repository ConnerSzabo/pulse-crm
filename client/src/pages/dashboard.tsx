import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Building2, CalendarDays, ListTodo, Users, TrendingUp, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import type { Show } from "@shared/schema";

function StatCard({ title, value, icon: Icon, color }: { title: string; value: number; icon: any; color: string }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
          </div>
          <div className={`w-12 h-12 rounded-full ${color} flex items-center justify-center`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function statusColor(status: string) {
  const map: Record<string, string> = {
    "Contacted": "bg-blue-100 text-blue-800",
    "In Conversation": "bg-yellow-100 text-yellow-800",
    "Sponsoring": "bg-green-100 text-green-800",
    "Confirmed": "bg-purple-100 text-purple-800",
    "Completed": "bg-gray-100 text-gray-800",
  };
  return map[status] || "bg-gray-100 text-gray-600";
}

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<any>({
    queryKey: ["/api/dashboard/stats"],
  });

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const upcomingShows: Show[] = stats?.upcomingShows || [];
  const recentActivities: any[] = stats?.recentActivities || [];

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">PokéPulse Dashboard</h1>
        <p className="text-muted-foreground mt-1">Partnership pipeline overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="TSOs" value={stats?.tsoCount ?? 0} icon={Building2} color="bg-[#e91e8c]" />
        <StatCard title="Shows" value={stats?.showCount ?? 0} icon={CalendarDays} color="bg-purple-600" />
        <StatCard title="Open Tasks" value={stats?.openTaskCount ?? 0} icon={ListTodo} color="bg-orange-500" />
        <StatCard title="Contacts" value={stats?.contactCount ?? 0} icon={Users} color="bg-blue-500" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upcoming Shows */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4" />
              Upcoming Shows
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingShows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming shows</p>
            ) : (
              <div className="space-y-3">
                {upcomingShows.map((show) => (
                  <Link key={show.id} href={`/show/${show.id}`}>
                    <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors">
                      <div>
                        <p className="font-medium text-sm">{show.showName}</p>
                        <p className="text-xs text-muted-foreground">
                          {show.city} {show.showDate ? `· ${format(new Date(show.showDate), "d MMM yyyy")}` : ""}
                        </p>
                      </div>
                      <Badge className={statusColor(show.status || "")}>{show.status}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            <Link href="/shows">
              <p className="text-xs text-[#e91e8c] mt-3 hover:underline cursor-pointer">View all shows →</p>
            </Link>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity</p>
            ) : (
              <div className="space-y-2">
                {recentActivities.slice(0, 8).map((act: any) => (
                  <div key={act.id} className="flex items-start gap-2 text-sm">
                    <span className="text-muted-foreground shrink-0 text-xs mt-0.5">
                      {format(new Date(act.createdAt), "d MMM")}
                    </span>
                    <span className="capitalize font-medium shrink-0">{act.type}</span>
                    <span className="text-muted-foreground truncate">{act.note}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
