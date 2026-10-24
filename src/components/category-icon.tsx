import {
  Baby,
  Banknote,
  Briefcase,
  Bus,
  Car,
  CircleDot,
  Clapperboard,
  Coffee,
  Coins,
  CreditCard,
  Dumbbell,
  FerrisWheel,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Landmark,
  Laptop,
  Music,
  PawPrint,
  Percent,
  PiggyBank,
  Plane,
  Receipt,
  ShoppingBag,
  Smartphone,
  Stethoscope,
  Tag,
  Ticket,
  Train,
  Tv,
  Utensils,
  Wallet,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const ICONS: Record<string, LucideIcon> = {
  baby: Baby,
  banknote: Banknote,
  briefcase: Briefcase,
  bus: Bus,
  car: Car,
  clapperboard: Clapperboard,
  coffee: Coffee,
  coins: Coins,
  "credit-card": CreditCard,
  dumbbell: Dumbbell,
  "ferris-wheel": FerrisWheel,
  fuel: Fuel,
  gamepad: Gamepad2,
  gift: Gift,
  "graduation-cap": GraduationCap,
  "heart-pulse": HeartPulse,
  home: Home,
  landmark: Landmark,
  laptop: Laptop,
  music: Music,
  "paw-print": PawPrint,
  percent: Percent,
  "piggy-bank": PiggyBank,
  plane: Plane,
  receipt: Receipt,
  "shopping-bag": ShoppingBag,
  smartphone: Smartphone,
  stethoscope: Stethoscope,
  tag: Tag,
  target: CircleDot,
  ticket: Ticket,
  train: Train,
  tv: Tv,
  utensils: Utensils,
  wallet: Wallet,
  wifi: Wifi,
  wrench: Wrench,
  zap: Zap,
};

export const AVAILABLE_ICONS = Object.keys(ICONS);

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value);
}

/** User-supplied category colors are stored as text. Only a hex value is safe to paint. */
export function safeHexColor(
  color: string | null | undefined,
  fallback = "#64748b",
): string {
  if (color && HEX_COLOR.test(color)) return color;
  return fallback;
}

const NAME_ICON_HINTS: [RegExp, string][] = [
  [/apartment|housing|rent|home/i, "home"],
  [/grocer|supermarket/i, "shopping-bag"],
  [/dining|restaurant|food|meal/i, "utensils"],
  [/transport|train|metro|commute|travel/i, "train"],
  [/entertain|cinema|movie|leisure/i, "ticket"],
  [/shop/i, "shopping-bag"],
  [/bank|fee/i, "landmark"],
  [/health|medical|pharma/i, "heart-pulse"],
  [/salary|income|work/i, "briefcase"],
];

/**
 * Icon to display for a category: its chosen icon, or — when it still has the
 * generic "tag" default — a semantic icon guessed from its name.
 */
export function resolveCategoryIcon(icon: string, name: string): string {
  if (icon !== "tag" && ICONS[icon]) return icon;
  return NAME_ICON_HINTS.find(([pattern]) => pattern.test(name))?.[1] ?? "tag";
}

export function CategoryIcon({
  icon,
  color,
  className,
  size = 20,
  plain = false,
}: {
  icon: string;
  color?: string;
  className?: string;
  size?: number;
  plain?: boolean;
}) {
  const Icon = ICONS[icon] ?? Tag;
  const paint = color ? safeHexColor(color, "var(--primary)") : "var(--primary)";
  if (plain) {
    return (
      <Icon
        size={size}
        className={className}
        style={{ color: paint }}
      />
    );
  }
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full",
        className,
      )}
      style={{
        width: size + 16,
        height: size + 16,
        backgroundColor: color && isHexColor(color) ? `${color}22` : "var(--muted)",
        color: paint,
      }}
    >
      <Icon size={size} />
    </span>
  );
}
