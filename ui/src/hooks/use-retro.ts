import { Retro } from "@/types";
import { createContext, useContext } from "react";

type RetroContextType = {
  retro: Retro;
  setRetro: (retro: Retro) => void;
};

export const RetroContext = createContext<RetroContextType>(
  {} as RetroContextType,
);

export default function useRetro() {
  const ctx = useContext(RetroContext);

  if (ctx === undefined)
    throw new Error("useRetro must be used within a RetroContext");

  return ctx;
}
