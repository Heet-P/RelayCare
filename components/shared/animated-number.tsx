"use client";

import NumberFlow from "@number-flow/react";

/** Numbers that roll to their new value when live data changes (respects reduced motion). */
export function AnimatedNumber({ value, suffix }: { value: number; suffix?: string }) {
  return <NumberFlow value={value} suffix={suffix} willChange respectMotionPreference className="font-tag" />;
}
