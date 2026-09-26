import { motion } from "framer-motion";
import { useId, useRef, type KeyboardEvent } from "react";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

/**
 * A single-choice control announced as a radio group. Arrow keys move the choice (and focus) like
 * native radios, and only the selected segment is in the tab order. The thumb slides between
 * segments so the change of state is visible, not just a color swap.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
  className = "",
}: {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const thumbId = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next].value);
    buttons.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} className={`flex rounded-lg bg-sunken p-[3px] ${className}`}>
      {options.map((option, i) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              buttons.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`relative flex-1 whitespace-nowrap rounded-md font-medium ${
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-[13px]"
            } ${selected ? "text-ink" : "text-ink-3 hover:text-ink"}`}
          >
            {selected && (
              <motion.span
                layoutId={thumbId}
                aria-hidden="true"
                className="absolute inset-0 rounded-md bg-raised shadow-[0_1px_2px_rgb(0_0_0/0.08),0_0_0_1px_var(--line)]"
                transition={{ type: "spring", stiffness: 520, damping: 40 }}
              />
            )}
            <span className="relative">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
