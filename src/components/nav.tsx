"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  motion,
  MotionConfig,
  useReducedMotion,
  type Transition,
} from "motion/react";
import { useId } from "react";
import {
  LayoutDashboard,
  Wallet,
  Receipt,
  LineChart,
  Settings,
  Target,
  PiggyBank,
  Coins,
  PieChart,
  TrendingUp,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BlurAmountsToggle } from "@/components/blur-amounts-toggle";
import { ThemeToggle } from "@/components/theme-toggle";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

function buildGroups(billAlertCount: number): NavGroup[] {
  return [
    {
      label: "Overview",
      items: [
        { href: "/", label: "Dashboard", icon: LayoutDashboard },
        { href: "/forecast", label: "Forecast", icon: TrendingUp },
      ],
    },
    {
      label: "Money",
      items: [
        { href: "/accounts", label: "Accounts", icon: Wallet },
        { href: "/expenses", label: "Expenses", icon: Receipt },
        {
          href: "/bills",
          label: "Bills",
          icon: CalendarClock,
          badge: billAlertCount,
        },
        { href: "/goals", label: "Budgets", icon: Target },
        { href: "/savings", label: "Savings", icon: PiggyBank },
      ],
    },
    {
      label: "Investments",
      items: [
        { href: "/portfolio", label: "Portfolio", icon: LineChart },
        { href: "/crypto", label: "Crypto", icon: Coins },
      ],
    },
    {
      label: "System",
      items: [{ href: "/settings", label: "Settings", icon: Settings }],
    },
  ];
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Same spring as motion tabs — slight overshoot, settles with life. */
const sidebarTransition: Transition = {
  type: "spring",
  stiffness: 170,
  damping: 24,
  mass: 1.2,
};

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#C2410C] px-1 text-[10px] font-semibold leading-none text-[#FEF3EE]">
      {count}
    </span>
  );
}

function SidebarNav({ billAlertCount }: { billAlertCount: number }) {
  const pathname = usePathname();
  const groups = buildGroups(billAlertCount);
  const layoutId = useId();
  const reduce = useReducedMotion();

  return (
    <MotionConfig transition={reduce ? { duration: 0 } : sidebarTransition}>
      <motion.nav
        layoutRoot
        className="flex h-full w-[230px] flex-col border-r border-border bg-card [border-right-width:0.5px]"
      >
        {/* pt-12 clears macOS traffic lights (hiddenInset + y:16) */}
        <div className="px-3 pb-1 pt-12 [-webkit-app-region:drag]">
          <div className="flex items-center gap-2.5 rounded-xl border border-border bg-muted px-3 py-2.5 [border-width:0.5px] [-webkit-app-region:no-drag]">
            <div className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-lg border border-border bg-card [border-width:0.5px]">
              <PieChart
                className="h-[15px] w-[15px] text-foreground"
                strokeWidth={2.25}
              />
            </div>
            <span className="min-w-0 truncate text-[13px] font-semibold tracking-tight text-foreground">
              Finance Monitor
            </span>
          </div>
        </div>

        <div className="flex flex-1 flex-col px-3 py-3 [-webkit-app-region:no-drag]">
          {groups.map((group, groupIndex) => (
            <div key={group.label}>
              <p
                className={cn(
                  "mb-1.5 px-2 text-[11px] font-medium tracking-[-0.005em] text-muted-foreground",
                  groupIndex > 0 ? "mt-5" : "mt-1",
                )}
              >
                {group.label}
              </p>
              <ul className="flex flex-col gap-px">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href} className="relative">
                      {active ? (
                        <motion.span
                          layoutId={layoutId}
                          layout="position"
                          className="absolute inset-0 rounded-[10px] bg-muted shadow-[inset_0_0_0_0.5px_var(--border)]"
                          style={{ borderRadius: 10 }}
                        />
                      ) : null}
                      <Link
                        href={item.href}
                        className={cn(
                          "sb-item relative z-10 flex items-center gap-2.5 rounded-[10px] px-2 py-[7px] text-[13px] tracking-[-0.01em] transition-colors",
                          active
                            ? "sb-item active font-medium text-foreground"
                            : "font-normal text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                        )}
                      >
                        <span className="flex w-[17px] shrink-0 items-center justify-center">
                          <Icon
                            className={cn(
                              "h-[15px] w-[15px]",
                              active
                                ? "text-foreground"
                                : "text-muted-foreground",
                            )}
                            strokeWidth={2}
                          />
                        </span>
                        <span className="min-w-0 truncate">{item.label}</span>
                        {item.badge != null && <NavBadge count={item.badge} />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-1.5 px-3 pb-4 [-webkit-app-region:no-drag]">
          <ThemeToggle compact />
          <BlurAmountsToggle compact />
        </div>
      </motion.nav>
    </MotionConfig>
  );
}

/** Compact nav for mobile header — same routes, no sidebar chrome. */
function MobileNav({ billAlertCount }: { billAlertCount: number }) {
  const pathname = usePathname();
  const groups = buildGroups(billAlertCount);

  return (
    <nav className="flex flex-wrap gap-1">
      {groups.flatMap((g) => g.items).map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
              active
                ? "bg-primary-light text-primary"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {item.label}
            {item.badge != null && item.badge > 0 && (
              <span className="flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[#C2410C] px-1 text-[9px] font-semibold leading-none text-[#FEF3EE]">
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function Nav({
  billAlertCount = 0,
  variant = "sidebar",
}: {
  billAlertCount?: number;
  variant?: "sidebar" | "mobile";
}) {
  if (variant === "mobile") {
    return <MobileNav billAlertCount={billAlertCount} />;
  }
  return <SidebarNav billAlertCount={billAlertCount} />;
}
