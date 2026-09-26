/** Shared class strings for the few button shapes the app uses, so every control of the same kind
 *  looks and responds the same way. Radius rule: panels 12px, controls 8px, chips 6px. */

/** Quiet text button: toolbar actions, "Show more". */
export const ghostButton =
  "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-ink-2 hover:bg-ink/[0.06] hover:text-ink disabled:opacity-50";

/** Square icon-only button. Always pair it with an aria-label. */
export const iconButton =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-2 hover:bg-ink/[0.06] hover:text-ink disabled:opacity-50";

/** Bordered secondary button. */
export const outlineButton =
  "inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong bg-panel px-3 text-[13px] font-medium text-ink hover:bg-ink/[0.04] disabled:opacity-50";

/** Bordered text-field wrapper; the input inside it is borderless and transparent. */
export const fieldShell =
  "flex h-10 items-center gap-2 rounded-lg border border-line-strong bg-panel px-3 hover:border-ink-3 focus-within:border-focus focus-within:ring-3 focus-within:ring-focus/20";

/** Small label that sits above a control. */
export const fieldLabel = "text-[13px] font-medium text-ink-2";
