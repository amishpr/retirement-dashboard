import { motion, useMotionValue, useTransform, animate, type AnimationPlaybackControls } from "framer-motion";
import { useEffect, useRef } from "react";

export function AnimatedNumber({
  value,
  formatter,
  className,
  pulseOnChange = false,
}: {
  value: number;
  formatter: (n: number) => string;
  className?: string;
  /** Adds a brief scale pulse on top of the digit count-up whenever the value changes after mount —
   *  for the one number (the hero headline) that should feel the most alive when an input changes,
   *  versus the quieter stat tiles, which only count up. */
  pulseOnChange?: boolean;
}) {
  // Starts at the real value, not 0 — the first paint should show the correct number immediately.
  // Counting up from 0 on the very first mount just reads as the page briefly showing wrong data
  // before "correcting" itself. The count-up is worth keeping for later changes though (it's useful
  // feedback that adjusting an input actually moved the number), so it's skipped once, on mount only.
  const motionValue = useMotionValue(value);
  const rounded = useTransform(motionValue, (v) => formatter(v));
  const scale = useMotionValue(1);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1],
    });
    let pulseControls: AnimationPlaybackControls | undefined;
    if (pulseOnChange) {
      pulseControls = animate(scale, [1, 1.08, 1], { duration: 0.5, ease: "easeOut" });
    }
    return () => {
      controls.stop();
      pulseControls?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <motion.span className={className} style={{ display: "inline-block", scale }}>
      {rounded}
    </motion.span>
  );
}
