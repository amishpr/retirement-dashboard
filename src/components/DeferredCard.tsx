import { Component, Suspense, useEffect, useRef, type ReactNode, type Ref } from "react";

/**
 * A lower card's shape before it's drawn: the same border, radius, and padding as Card, with faint
 * bars where the title and chart go. It's sized to the real card at each breakpoint, so swapping one
 * for the other doesn't move anything. It stays still rather than pulsing; it's usually on screen
 * for well under a second, and a pulse would restart every time it's swapped for its twin.
 */
export function CardSkeleton({ className, ref }: { className: string; ref?: Ref<HTMLElement> }) {
  return (
    <section
      ref={ref}
      aria-hidden="true"
      className={`flex min-w-0 flex-col rounded-xl border border-line bg-panel p-5 sm:p-6 print:hidden ${className}`}
    >
      <div className="h-4 w-36 rounded bg-ink/[0.07]" />
      <div className="mt-2.5 h-3 w-64 max-w-full rounded bg-ink/[0.05]" />
      <div className="mt-6 flex-1 rounded-lg bg-ink/[0.035]" />
    </section>
  );
}

/** What's left in a card's place when its code can't be loaded, e.g. after a new deploy. */
class LoadFailure extends Component<{ className: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section
        className={`flex min-w-0 items-center justify-center rounded-xl border border-line bg-panel p-6 text-center text-[13px] text-ink-3 ${this.props.className}`}
      >
        Couldn't load this section. Reload the page to try again.
      </section>
    );
  }
}

/**
 * Holds a lower card's place with a skeleton until `show`, then draws the card, which may be a lazy
 * component. Scrolling toward the skeleton before its turn calls `onApproach`, so a fast scroller
 * doesn't wait on the queue.
 */
export function Deferred({
  show,
  onApproach,
  skeleton,
  children,
}: {
  show: boolean;
  onApproach: () => void;
  /** Height classes for the skeleton, matched to the real card at each breakpoint. */
  skeleton: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (show || !el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) onApproach();
    }, { rootMargin: "300px 0px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [show, onApproach]);

  if (!show) return <CardSkeleton ref={ref} className={skeleton} />;
  return (
    <LoadFailure className={skeleton}>
      <Suspense fallback={<CardSkeleton className={skeleton} />}>{children}</Suspense>
    </LoadFailure>
  );
}
