import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { useShortcut } from "@/keys/keys";
import type { Column } from "@/lib/retro";
import { useBoard } from "./context";

const LIMIT = 500;

export const field =
  "block w-full resize-none overflow-hidden border-l-[2.5px] border-ink bg-transparent py-2.5 pl-3 text-[17px] leading-snug font-medium text-ink outline-offset-2 placeholder:font-normal placeholder:text-ink-soft";

export function useGrow(ref: RefObject<HTMLTextAreaElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  });
}

export function focusComposer(index: number) {
  document.querySelector<HTMLTextAreaElement>(`[data-composer="${index}"]`)?.focus();
}

type Props = { column: Column; index: number; first: boolean; onUsed: (index: number) => void };

export function Composer({ column, index, first, onUsed }: Props) {
  const { board, run } = useBoard();
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  useGrow(ref);
  useShortcut({ id: `write-${index}`, keys: String(index + 1), label: `Write in ${column.title}`, section: "Retro", run: () => focusComposer(index) });

  async function submit() {
    const content = text.trim();
    if (!content) return;
    setText("");
    onUsed(index);
    if (!(await run("note.add", { columnId: column.id, content }))) setText((now) => now || content);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      e.currentTarget.blur();
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <textarea
        ref={ref}
        data-composer={index}
        rows={1}
        maxLength={LIMIT}
        value={text}
        placeholder="Write a thought"
        aria-label={`Add a thought to ${column.title}`}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={field}
      />
      {text.length > LIMIT - 100 && (
        <p className="pl-3 text-sm text-ink-soft tabular-nums">
          {text.length} / {LIMIT}
        </p>
      )}
      {focused && first && board.retro.stage === "reflect" && <p className="pl-3 text-sm text-ink-soft">Nobody else can read this until grouping. Enter saves.</p>}
    </div>
  );
}
