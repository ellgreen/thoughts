import { twMerge } from "tailwind-merge";

const headingVariants = {
  h1: "text-4xl font-extrabold tracking-tight lg:text-5xl",
  h2: "text-3xl font-semibold tracking-tight",
};

export function Heading({
  className,
  children,
  variant,
  ...props
}: {
  className?: string;
  children: React.ReactNode;
  variant: keyof typeof headingVariants;
}) {
  const Comp = variant;

  return (
    <Comp
      className={twMerge("scroll-m-20", headingVariants[variant], className)}
      {...props}
    >
      {children}
    </Comp>
  );
}
