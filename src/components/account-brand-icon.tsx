"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  Landmark,
  PiggyBank,
  Wallet,
  Banknote,
  Users,
} from "lucide-react";

function isBoursoBank(name: string) {
  const lower = name.toLowerCase();
  return lower.includes("bourso") || lower.includes("bourse");
}


const SIZE = {
  md: {
    box: "h-10 w-10",
    boxWide: "h-10 w-11",
    img: "h-8 w-8",
    imgSm: "h-7 w-7",
    icon: "h-5 w-5",
    text: "text-[11px]",
    textLg: "text-xl",
  },
  lg: {
    box: "h-12 w-12",
    boxWide: "h-12 w-[52px]",
    img: "h-10 w-10",
    imgSm: "h-9 w-9",
    icon: "h-6 w-6",
    text: "text-xs",
    textLg: "text-2xl",
  },
} as const;

export function CurrencyBadge({ currency }: { currency: string }) {
  const isEur = currency === "EUR";
  const isDkk = currency === "DKK";
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium leading-none",
        isEur && "bg-[#DBEAFE] text-[#1D4ED8] dark:bg-blue-950 dark:text-blue-300",
        isDkk && "bg-[#FFEDD5] text-[#C2410C] dark:bg-orange-950 dark:text-orange-300",
        !isEur && !isDkk && "bg-muted text-muted-foreground",
      )}
    >
      {currency}
    </span>
  );
}

/** Brand logo or type icon for an account (list rows, edit modal, etc.). */
export function AccountBrandIcon({
  name,
  type,
  currency,
  size = "md",
}: {
  name: string;
  type: string;
  currency?: string;
  size?: keyof typeof SIZE;
}) {
  const s = SIZE[size];
  const lower = name.toLowerCase();
  const isRevolutDkk =
    lower.includes("revolut") &&
    (lower.includes("dkk") || currency === "DKK");

  if (isRevolutDkk) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center gap-0.5 overflow-hidden rounded-lg border border-border bg-card px-0.5 shadow-sm",
          s.boxWide,
        )}
      >
        <Image
          src="/logos/revolut.png"
          alt="Revolut"
          width={size === "lg" ? 36 : 28}
          height={size === "lg" ? 36 : 28}
          className={cn("shrink-0 object-contain", s.imgSm)}
        />
      </div>
    );
  }

  if (lower.includes("revolut")) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-card shadow-sm",
          s.box,
        )}
      >
        <Image
          src="/logos/revolut.png"
          alt="Revolut"
          width={size === "lg" ? 40 : 32}
          height={size === "lg" ? 40 : 32}
          className={cn("object-contain", s.img)}
        />
      </div>
    );
  }

  if (lower.includes("n26")) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg bg-[#27A87C] shadow-sm",
          s.box,
        )}
      >
        <span className={cn("font-bold tracking-tight text-white", s.text)}>
          N26
        </span>
      </div>
    );
  }

  if (lower.includes("vivid")) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#7F3DFF] shadow-sm",
          s.box,
        )}
      >
        <Image
          src="/logos/vivid.png"
          alt="Vivid"
          width={size === "lg" ? 40 : 32}
          height={size === "lg" ? 40 : 32}
          className={cn("object-contain", s.img)}
        />
      </div>
    );
  }

  if (lower.includes("nexo")) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-card shadow-sm",
          s.box,
        )}
      >
        <Image
          src="/logos/nexo.png"
          alt="Nexo"
          width={size === "lg" ? 40 : 32}
          height={size === "lg" ? 40 : 32}
          className={cn("object-contain", s.img)}
        />
      </div>
    );
  }

  if (isBoursoBank(name)) {
    return (
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-lg shadow-sm",
          s.box,
        )}
      >
        <Image
          src="/logos/boursobank.png"
          alt="BoursoBank"
          fill
          sizes={size === "lg" ? "48px" : "40px"}
          className="object-cover"
        />
      </div>
    );
  }

  if (lower.includes("joint") || lower.includes("compte")) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg border border-border bg-card shadow-sm",
          s.box,
        )}
      >
        <Users className={s.icon} strokeWidth={1.75} />
      </div>
    );
  }

  if (lower.includes("savings") || type === "savings") {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg border border-border bg-card shadow-sm",
          s.box,
        )}
      >
        <PiggyBank className={s.icon} strokeWidth={1.75} />
      </div>
    );
  }

  if (type === "cash") {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg border border-border bg-card shadow-sm",
          s.box,
        )}
      >
        <Banknote className={s.icon} strokeWidth={1.75} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg border border-border bg-card shadow-sm",
        s.box,
      )}
    >
      {type === "savings" ? (
        <PiggyBank className={cn(s.icon, "text-foreground")} strokeWidth={1.75} />
      ) : type === "cash" ? (
        <Banknote className={cn(s.icon, "text-foreground")} strokeWidth={1.75} />
      ) : type === "checking" ? (
        <Wallet className={cn(s.icon, "text-primary")} strokeWidth={1.75} />
      ) : (
        <Landmark className={cn(s.icon, "text-muted-foreground")} strokeWidth={1.75} />
      )}
    </div>
  );
}
