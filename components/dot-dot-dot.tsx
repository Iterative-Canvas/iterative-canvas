// update the props to accept children (restrict to a string if possible)
export function DotDotDot({ children }: { children: string }) {
  return (
    <span role="status" className="inline-flex font-mono items-baseline">
      {children}
      <span
        className="ml-1 inline-flex w-[3ch] justify-start"
        aria-hidden="true"
      >
        <span className="animate-pulse [animation-duration:900ms] [animation-delay:0ms]">
          .
        </span>
        <span className="animate-pulse [animation-duration:900ms] [animation-delay:300ms]">
          .
        </span>
        <span className="animate-pulse [animation-duration:900ms] [animation-delay:600ms]">
          .
        </span>
      </span>
    </span>
  )
}
