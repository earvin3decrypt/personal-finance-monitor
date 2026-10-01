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
  train: Train,
  tv: Tv,
  utensils: Utensils,
  wallet: Wallet,
  wifi: Wifi,
  wrench: Wrench,
  zap: Zap,
};

export const AVAILABLE_ICONS = Object.keys(ICONS);

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
  if (plain) {
    return (
      <Icon
        size={size}
        className={className}
        style={{ color: color ?? "var(--primary)" }}
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
        backgroundColor: color ? `${color}22` : "var(--muted)",
        color: color ?? "var(--primary)",
      }}
    >
      <Icon size={size} />
    </span>
  );
}
