import { cn } from "@/lib/utils";
import { useCallback, useLayoutEffect, useRef } from "react";
import { textareaClassName } from "./textarea";

/**
 * A textarea that grows with its content.
 *
 * Sized in JS rather than with `field-sizing: content`, which only Chrome
 * supports, and renders its own element so the ref reaches the real node.
 */
export function AutoTextarea({
  className,
  value,
  onChange,
  maxHeight = 180,
  // Pulled out of props: callers spread a react-hook-form field here, whose
  // own ref would otherwise land after ours and win.
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

  // Before paint, and covers value changing from outside.
  useLayoutEffect(resize, [value, resize]);

  return (
    <textarea
      ref={attachRef}
      data-slot="textarea"
      // One row, so height: auto can collapse below two lines.
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
