"use client"

import { useQRCode } from "next-qrcode"

type QrCodeSvgProps = {
  value: string
  size?: number
  className?: string
  title?: string
}

// Renders the payment code via the well-tested `qrcode` package (through
// next-qrcode) rather than the hand-rolled, from-scratch encoder this
// component used to wrap. That encoder was hard-capped at 53 bytes of
// payload (fixed at QR Version 3, error correction level L), but the server
// always hands out a 64-character hash — so it threw "QR payload too long"
// on every single render instead of ever showing a QR code.
export function QrCodeSvg({ value, size = 200, className, title = "QR code de paiement" }: QrCodeSvgProps) {
  const { Image } = useQRCode()

  return (
    <div
      className={`${className ?? ""} [&>img]:size-full [&>img]:object-contain`}
      role="img"
      aria-label={title}
    >
      <Image
        text={value}
        options={{
          errorCorrectionLevel: "M",
          margin: 1,
          width: Math.max(size * 2, 256),
        }}
      />
    </div>
  )
}
