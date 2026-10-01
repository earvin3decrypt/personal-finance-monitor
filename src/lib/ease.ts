/** Cubic-bezier ease-out used for short content fades. */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/** Snappy spring for press / hover scale on interactive controls. */
export const SPRING_PRESS = {
  type: "spring",
  stiffness: 520,
  damping: 28,
  mass: 0.6,
} as const;
