import { cn } from "@/lib/utils";
import { useCallback, useLayoutEffect, useRef } from "react";
import { textareaClassName } from "./textarea";

/**
 * A textarea that grows with its content instead of hiding it behind a
 * scrollbar.
 *
 * Sized in JS rather than with CSS `field-sizing: content`, which only Chrome
 * supports - in Safari and Firefox that leaves a fixed box, which is exactly
 * the problem this is here to solve.
 *
 * Renders its own element rather than wrapping Textarea: the ref has to reach
 * the real node to measure it.
 */
export function AutoTextarea({
  className,
  value,
  onChange,
  maxHeight = 180,
  // Pulled out of props deliberately. Callers spread a react-hook-form field
  // here, which carries its own ref; left in the spread it would land after
  // ours and win, leaving nothing to measure.
  ref: forwardedRef,
  ...props
}: React.ComponentProps<"textarea"> & { maxHeight?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const attachRef = useCallback(
    (node: HTMLTextAreaElement | null) => {
      ref.current = node;

      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    },
    [forwardedRef],
  );

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    // Collapse first, or scrollHeight only ever reports the current height.
    el.style.height = "auto";

    const next = Math.min(el.scrollHeight, maxHeight);

    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [maxHeight]);

  // Layout effect so it is sized before paint. Also covers value changing from
  // outside, such as a template or an AI generation filling the form in.
  useLayoutEffect(resize, [value, resize]);

  return (
    <textarea
      ref={attachRef}
      data-slot="textarea"
      // One row, so height: auto collapses to a single line and scrollHeight
      // reports what the content actually needs.
      rows={1}
      value={value}
      onChange={(event) => {
        onChange?.(event);
        resize();
      }}
      className={cn(textareaClassName, "resize-none", className)}
      {...props}
    />
  );
}
