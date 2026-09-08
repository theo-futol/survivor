import Image from "next/image"

import { BRAND } from "@/lib/brand"
import { cn } from "@/lib/utils"

export function BrandLogo({
  inverse = false,
  compact = false,
  className,
}: {
  inverse?: boolean
  compact?: boolean
  className?: string
}) {
  const src = compact
    ? "/logo-mark.png"
    : inverse
      ? "/logo-white.png"
      : "/logo.png"

  return (
    <span
      className={cn("inline-flex items-center", className)}
      aria-label={BRAND.name}
    >
      <Image
        src={src}
        alt={compact ? "" : BRAND.name}
        width={compact ? 48 : 220}
        height={compact ? 48 : 80}
        priority
        className={cn(
          "object-contain",
          compact
            ? "size-10"
            : "h-auto w-[150px] sm:w-[180px] lg:w-[210px]"
        )}
      />
    </span>
  )
}
