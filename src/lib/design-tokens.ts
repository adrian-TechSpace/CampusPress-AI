export const springs = {
  heavy: { type: "spring", stiffness: 80, damping: 18, mass: 1.2 },
  default: { type: "spring", stiffness: 140, damping: 20, mass: 0.8 },
  snappy: { type: "spring", stiffness: 300, damping: 28, mass: 0.5 },
  drift: { type: "spring", stiffness: 60, damping: 15, mass: 1 },
} as const;

export const chrislandTokens = {
  neutral: "zinc",
  accent: "chrisland-purple",
  reserved: "chrisland-gold",
} as const;
