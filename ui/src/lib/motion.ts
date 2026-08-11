import type { Transition, Variants } from "motion/react";

export const spring: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 32,
  mass: 0.6,
};

export const springy: Transition = {
  type: "spring",
  stiffness: 550,
  damping: 22,
  mass: 0.5,
};

export const ease: Transition = {
  duration: 0.18,
  ease: [0.32, 0.72, 0, 1],
};

export const cardVariants: Variants = {
  initial: { opacity: 0, y: 8, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1, transition: spring },
  exit: { opacity: 0, scale: 0.94, transition: ease },
};

export const panelVariants: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: ease },
  exit: { opacity: 0, y: -6, transition: ease },
};

const maxStagger = 0.24;

export function stagger(index: number, step = 0.03): Transition {
  return { ...spring, delay: Math.min(index * step, maxStagger) };
}
