import { twMerge } from "tailwind-merge";

export default function Container({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={twMerge(
        "mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8",
        className,
      )}
      {...props}
    />
  );
}
