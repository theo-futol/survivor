"use client"

import { useEffect, useState } from "react"
import { Dialog } from "@base-ui/react/dialog"
import { XIcon } from "lucide-react"
import { useQRCode } from "next-qrcode"

import { Button } from "@/components/ui/button"

const EXPIRY_SECONDS = 5 * 60
const QR_CODE_URL =
  "https://cxsmicguy.hashnode.dev/image-compression-with-nodejs-and-sharp"

type PartnerQrCodeProps = {
  partnerName: string
  onClose: () => void
}

export function PartnerQrCode({ partnerName, onClose }: PartnerQrCodeProps) {
  const { Image } = useQRCode()
  const [secondsRemaining, setSecondsRemaining] = useState(EXPIRY_SECONDS)

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSecondsRemaining((current) => {
        if (current <= 1) {
          window.clearInterval(interval)
          onClose()
          return 0
        }

        return current - 1
      })
    }, 1000)

    return () => window.clearInterval(interval)
  }, [onClose])

  const minutes = Math.floor(secondsRemaining / 60)
  const seconds = String(secondsRemaining % 60).padStart(2, "0")

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/25 backdrop-blur-sm" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-6 text-card-foreground shadow-xl">
          <Dialog.Title className="pr-8 text-lg font-semibold">
            QR code
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            Présentez ce code pour {partnerName}.
          </Dialog.Description>

          <Dialog.Close
            aria-label="Fermer la fenêtre QR code"
            className="absolute top-3 right-3 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <XIcon className="size-4" />
          </Dialog.Close>

          <div className="mt-5 flex justify-center rounded-lg bg-white p-4">
            {/* next-qrcode's Image component does not expose an alt prop. */}
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image
              text={QR_CODE_URL}
              options={{
                type: "image/jpeg",
                quality: 1,
                errorCorrectionLevel: "M",
                margin: 3,
                scale: 4,
                width: 200,
                color: {
                  dark: "#000",
                  light: "#FFFFFF",
                },
              }}
            />
          </div>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Ce code expire dans {minutes}:{seconds}
          </p>

          <Button
            type="button"
            variant="outline"
            className="mt-4 w-full"
            onClick={onClose}
          >
            Fermer
          </Button>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
