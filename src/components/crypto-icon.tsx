"use client";

import Image from "next/image";
import { useState } from "react";
import { getCryptoLogoSrc } from "@/lib/crypto-symbols";
import { cn } from "@/lib/utils";

const SIZE = {
  sm: {
    box: "h-7 w-7",
    text: "text-[9px]",
  },
  md: {
    box: "h-9 w-9",
    text: "text-[10px]",
  },
} as const;

function SymbolFallback({
  symbol,
  size,
}: {
  symbol: string;
  size: keyof typeof SIZE;
}) {
  const s = SIZE[size];
  const label = symbol.trim().toUpperCase().slice(0, 3);

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg bg-amber-500/15",
        s.box,
      )}
    >
      <span
        className={cn(
          "font-semibold text-amber-700 dark:text-amber-300",
          s.text,
        )}
      >
        {label}
      </span>
    </div>
  );
}

export function CryptoIcon({
  symbol,
  size = "md",
  className,
}: {
  symbol: string;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const logo = getCryptoLogoSrc(symbol);
  const s = SIZE[size];

  if (!logo || failed) {
    return (
      <div className={className}>
        <SymbolFallback symbol={symbol} size={size} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center",
        s.box,
        className,
      )}
    >
      {logo.local ? (
        <Image
          src={logo.src}
          alt={symbol}
          width={size === "md" ? 36 : 28}
          height={size === "md" ? 36 : 28}
          className={cn("object-contain", s.box)}
          onError={() => setFailed(true)}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo.src}
          alt={symbol}
          className={cn("object-contain", s.box)}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
