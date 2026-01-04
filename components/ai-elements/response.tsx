"use client"

import { cn } from "@/lib/utils"
import { type ComponentProps, memo } from "react"
import { Streamdown } from "streamdown"

type ResponseProps = ComponentProps<typeof Streamdown> & { shimmer?: boolean }

function ShimmerOverlay() {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 animate-streamdown-shimmer",
        "bg-no-repeat",
        "bg-[linear-gradient(90deg,transparent_44%,rgba(255,255,255,0.6)_50%,transparent_56%)]",
        "bg-[length:300%_100%]",
        "opacity-60"
      )}
    />
  );
}

export const Response = memo(
  ({ className, shimmer = false, ...props }: ResponseProps) => (
    <div className={cn("relative", shimmer && "opacity-70")}>
      <Streamdown
        className={cn(
          "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
          className
        )}
        {...props}
      />
      {shimmer && (
        <div className="pointer-events-none absolute inset-0">
          <ShimmerOverlay />
        </div>
      )}
    </div>
  ),
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    prevProps.shimmer === nextProps.shimmer &&
    prevProps.className === nextProps.className
);

Response.displayName = "Response"
