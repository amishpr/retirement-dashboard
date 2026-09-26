import { motion, useMotionValue, useReducedMotion, useTransform, animate } from "framer-motion";
import { useEffect, useRef } from "react";

export function AnimatedNumber({
  value,
  formatter,
  className = "",
}: {
  value: number;
  formatter: (n: number) => string;
  className?: string;
}) {
  // Starts at the real value, not 0 — the first paint should show the correct number immediately.
  // Counting up from 0 on the very first mount just reads as the page briefly showing wrong data
  // before "correcting" itself. The count-up is worth keeping for later changes though (it's useful
  // feedback that adjusting an input actually moved the number), so it's skipped once, on mount only.
  // Reduced-motion visitors get an instant jump instead. (MotionConfig in main.tsx only reaches
  // motion components, not imperative animate() calls like this one, hence the explicit check.)
  const reduceMotion = useReducedMotion();
  const motionValue = useMotionValue(value);
  const rounded = useTransform(motionValue, (v) => formatter(v));
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current || reduceMotion) {
      isFirstRender.current = false;
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1],
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Tabular figures keep every digit the same width, so the number doesn't jitter while it counts.
  return <motion.span className={`tabular-nums ${className}`}>{rounded}</motion.span>;
}
