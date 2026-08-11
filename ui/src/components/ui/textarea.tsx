import * as React from "react"

import { cn } from "@/lib/utils"
import { textareaClassName } from "@/components/ui/textarea-class"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(textareaClassName, "field-sizing-content min-h-16", className)}
      {...props}
    />
  )
}

export { Textarea }
