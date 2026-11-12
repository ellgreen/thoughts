import type { Transition } from "motion/react";

export const quick: Transition = { duration: 0.12, ease: "easeOut" };
export const enter: Transition = { duration: 0.18, ease: "easeOut" };
export const move: Transition = { type: "spring", stiffness: 520, damping: 38, mass: 0.8 };
export const thud: Transition = { type: "spring", stiffness: 700, damping: 22 };
export const pass = 0.7;

export const printIn = { clipPath: "inset(0 0 100% 0)" };
export const printed = { clipPath: "inset(0 0 0% 0)" };
