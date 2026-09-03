"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ShieldCheck, X } from "lucide-react"

import { Button } from "@/components/ui/button"

const STORAGE_KEY = "ticket-tout-privacy-notice-v1"

export function PrivacyNotice() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      setVisible(window.localStorage.getItem(STORAGE_KEY) !== "acknowledged")
    } catch {
      setVisible(true)
    }
  }, [])

  function acknowledge() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "acknowledged")
    } catch {
      // Le bandeau peut quand même être fermé si le stockage local est bloqué.
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <aside
      aria-label="Information sur la protection des données"
      className="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-4xl rounded-2xl border bg-background/98 p-4 shadow-2xl backdrop-blur sm:p-5"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 hidden size-10 shrink-0 place-items-center rounded-full bg-secondary text-primary sm:grid">
          <ShieldCheck className="size-5" aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="text-base font-black">Protection de vos pièces justificatives</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Les pièces justificatives transmises lors d&apos;une demande de création de compte, comme un extrait Kbis,
            ne sont pas enregistrées dans la base de données applicative. Elles sont conservées temporairement dans un
            espace sécurisé, uniquement le temps d&apos;instruire la demande, puis supprimées dès la décision
            d&apos;acceptation ou de refus et, dans tous les cas, au plus tard 30 jours après leur dépôt. Les informations
            nécessaires au fonctionnement du compte (par exemple nom, email ou SIRET) sont traitées séparément selon
            notre{" "}
            <Link href="/politique-confidentialite" className="font-bold text-primary underline underline-offset-4">
              politique de confidentialité
            </Link>
            .
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button type="button" size="sm" onClick={acknowledge}>
              J&apos;ai compris
            </Button>
            <span className="text-xs text-muted-foreground">
              Ce choix est mémorisé uniquement dans votre navigateur.
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={acknowledge}
          className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label="Fermer l'information"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </aside>
  )
}
