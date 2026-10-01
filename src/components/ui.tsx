import Link from "next/link";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-6 [border-width:0.5px]",
        "shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_24px_-16px_rgb(0_0_0/0.1)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-[-0.02em]">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function OfflineBanner({
  fxStale,
  pricesStale,
  refreshAction,
}: {
  fxStale?: boolean;
  pricesStale?: boolean;
  refreshAction?: ReactNode;
}) {
  if (!fxStale && !pricesStale) return null;
  const parts: string[] = [];
  if (fxStale) parts.push("FX rates");
  if (pricesStale) parts.push("stock prices");
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
      <p>
        Could not load live {parts.join(" and ")} — showing cached values when
        available. Use Refresh to try again.
      </p>
      {refreshAction}
    </div>
  );
}

function Sparkline({
  data,
  color,
  positive,
}: {
  data: number[];
  color?: string;
  positive?: boolean;
}) {
  const reactId = useId().replace(/:/g, "");
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const height = 44;
  const width = 112;
  const padY = 3;
  const chartH = height - padY * 2;

  const coords = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = padY + chartH - ((d - min) / range) * chartH;
    return { x, y };
  });

  const linePoints = coords.map((p) => `${p.x},${p.y}`).join(" ");
  const first = coords[0];
  const last = coords[coords.length - 1];
  const areaPath = [
    `M ${first.x} ${height}`,
    `L ${first.x} ${first.y}`,
    ...coords.slice(1).map((p) => `L ${p.x} ${p.y}`),
    `L ${last.x} ${height}`,
    "Z",
  ].join(" ");

  const strokeColor =
    color ?? (positive ? "var(--gain)" : "var(--loss)");
  const gradientId = `spark-fill-${reactId}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0 overflow-visible"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.35" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        points={linePoints}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const statCardShellClass =
  "relative flex h-full w-full min-h-[8.5rem] flex-col overflow-hidden rounded-2xl border border-border bg-card p-5 [border-width:0.5px] shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_24px_-16px_rgb(0_0_0/0.1)]";

export function StatCard({
  label,
  value,
  sub,
  href,
  className,
  icon,
  trend,
  trendLabel = "vs last month",
  sparklineData,
  accentColor,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  href?: string;
  className?: string;
  icon?: ReactNode;
  trend?: number | null;
  trendLabel?: string;
  sparklineData?: number[];
  accentColor?: string;
}) {
  const trendPositive = trend != null && trend >= 0;
  const trendDisplay =
    trend != null
      ? `${trendPositive ? "+" : ""}${trend.toFixed(1)}%`
      : null;

  const inner = (
    <div className="flex h-full flex-col justify-between gap-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground">
          {label}
        </p>
        {icon && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary">
            {icon}
          </span>
        )}
      </div>
      <div className="space-y-1">
        <div className="blur-amount flex flex-nowrap items-center gap-8">
          <p className="text-2xl font-semibold tabular-nums tracking-tight lg:text-3xl">
            {value}
          </p>
          {sparklineData && sparklineData.length > 1 ? (
            <Sparkline
              data={sparklineData}
              color={accentColor}
              positive={trendPositive}
            />
          ) : null}
        </div>
        {trendDisplay != null ? (
          <p className="text-xs leading-snug">
            <span
              className={cn(
                "font-medium",
                trendPositive ? "text-gain" : "text-loss",
              )}
            >
              {trendDisplay}
            </span>
            <span className="text-foreground"> {trendLabel}</span>
          </p>
        ) : sub ? (
          <p className="text-xs text-muted-foreground">{sub}</p>
        ) : null}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          statCardShellClass,
          "transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_2px_4px_rgb(0_0_0/0.04),0_16px_32px_-16px_rgb(0_0_0/0.14)]",
          className,
        )}
      >
        {inner}
      </Link>
    );
  }

  return <div className={cn(statCardShellClass, className)}>{inner}</div>;
}

export function Button({
  children,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const variants = {
    primary:
      "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
    secondary:
      "border border-border bg-card shadow-sm [border-width:0.5px] hover:bg-muted",
    ghost: "hover:bg-muted",
    danger: "border border-loss/30 text-loss [border-width:0.5px] hover:bg-loss/5",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[10px] px-4 py-2 text-sm font-medium transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-[10px] border border-border bg-card px-3 py-2 text-sm outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground/70 focus:border-primary/50 focus:ring-4 focus:ring-primary/10",
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cn("relative w-full", className)}>
      <select
        className="w-full appearance-none rounded-[10px] border border-border bg-card py-2 pl-3 pr-10 text-sm outline-none transition-[border-color,box-shadow] duration-150 focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
        {...props}
      >
        {children}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </div>
    </div>
  );
}

export function Label({
  children,
  htmlFor,
  className,
}: {
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "mb-1.5 block text-[13px] font-medium text-muted-foreground",
        className,
      )}
    >
      {children}
    </label>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <button
        type="button"
        className="modal-backdrop-in absolute inset-0 bg-background/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close dialog"
      />
      <div
        className={cn(
          "modal-panel-in relative flex max-h-[min(90vh,720px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl [border-width:0.5px]",
          className,
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          {typeof title === "string" ? (
            <h2 id="modal-title" className="text-lg font-semibold tracking-tight">
              {title}
            </h2>
          ) : (
            <div id="modal-title" className="min-w-0 flex-1">
              {title}
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-4 shrink-0 rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <span className="sr-only">Close</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="border-t border-border bg-muted/20 px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function PlValue({
  value,
  percent,
}: {
  value: number | null;
  percent?: number | null;
}) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const positive = value >= 0;
  return (
    <span className={positive ? "text-gain" : "text-loss"}>
      {positive ? "+" : ""}
      {value.toFixed(2)}
      {percent != null && (
        <span className="ml-1 text-xs">({percent >= 0 ? "+" : ""}{percent.toFixed(2)}%)</span>
      )}
    </span>
  );
}
