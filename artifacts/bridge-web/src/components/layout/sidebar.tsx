import { Link, useLocation } from "wouter";
import { Activity, BarChart2, FileDown, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Bridge Setup", icon: Settings },
  { href: "/progress", label: "Inspection Progress", icon: BarChart2 },
  { href: "/review", label: "Review & Export", icon: FileDown },
];

export function AppSidebar() {
  const [location] = useLocation();
  return (
    <aside className="w-56 min-h-screen bg-card border-r border-border flex flex-col flex-shrink-0">
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-border">
        <Activity className="h-5 w-5 text-primary flex-shrink-0" />
        <div>
          <p className="text-xs font-bold text-foreground tracking-widest uppercase">Bridge Mgr</p>
          <p className="text-[10px] text-muted-foreground">Inspection Companion</p>
        </div>
      </div>

      <nav className="flex-1 p-3 flex flex-col gap-0.5">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1 mt-1">Modules</p>
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = location === href;
          return (
            <Link
              key={href}
              href={href}
              data-testid={`nav-${href.replace("/", "") || "home"}`}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
                active
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-3 border-t border-border">
        <p className="text-[10px] text-muted-foreground leading-relaxed">AASHTO MBEI 2019<br />File-based · Offline-ready</p>
      </div>
    </aside>
  );
}
