"use client"

import { useEffect, useRef, useState } from "react"
import "leaflet/dist/leaflet.css"

import { cn } from "@/lib/utils"

type PartnersMap = {
  id: string
  name: string
  address: string
  coordinates: { latitude: number; longitude: number }
}

type ReunionMapProps = {
  className?: string
  partners: PartnersMap[]
  partnersSelected?: PartnersMap
}

const REUNION_CENTER: [number, number] = [-21.1151, 55.5364]

export function ReunionMap({ className, partners, partnersSelected }: ReunionMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import("leaflet").Map | null>(null)
  const markersLayerRef = useRef<import("leaflet").LayerGroup | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [themeRevision, setThemeRevision] = useState(0)

  useEffect(() => {
    const observer = new MutationObserver(() => setThemeRevision((value) => value + 1))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let cancelled = false
    void import("leaflet").then((L) => {
      if (cancelled) return

      const map = L.map(container, {
        center: REUNION_CENTER,
        zoom: 10,
        scrollWheelZoom: false,
      })

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map)

      mapRef.current = map
      markersLayerRef.current = L.layerGroup().addTo(map)
      setMapReady(true)
      requestAnimationFrame(() => map.invalidateSize())
    })

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      markersLayerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!mapReady || !markersLayerRef.current) return

    const styles = getComputedStyle(document.documentElement)
    const markerColor = styles.getPropertyValue("--primary").trim()
    const markerFill = styles.getPropertyValue("--brand-blue-bright").trim()

    void import("leaflet").then((L) => {
      const layer = markersLayerRef.current
      if (!layer) return

      layer.clearLayers()

      partners.forEach((partner) => {
        const coordinates: [number, number] = [
          partner.coordinates.latitude,
          partner.coordinates.longitude,
        ]

        const marker = L.circleMarker(coordinates, {
          radius: 7,
          color: markerColor,
          fillColor: markerFill,
          fillOpacity: 0.9,
          weight: 2,
        })
          .bindTooltip(partner.name, { direction: "top" })
          .bindPopup(`<strong>${partner.name}</strong><br>${partner.address}`)
          .addTo(layer)

        const markerElement = marker.getElement()
        if (!markerElement) return

        markerElement.setAttribute("tabindex", "0")
        markerElement.setAttribute("role", "button")
        markerElement.setAttribute(
          "aria-label",
          `${partner.name}, ${partner.address}. Appuyez sur Entrée ou Espace pour afficher l'adresse.`
        )

        markerElement.addEventListener("focus", () => {
          marker.openTooltip()
          marker.setRadius(9)
          marker.setStyle({ weight: 4 })
        })

        markerElement.addEventListener("blur", () => {
          marker.closeTooltip()
          marker.setRadius(7)
          marker.setStyle({ weight: 2 })
        })

        markerElement.addEventListener("keydown", (event: KeyboardEvent) => {
          if (event.key !== "Enter" && event.key !== " ") return

          event.preventDefault()
          mapRef.current?.panTo(coordinates)
          marker.openPopup()
        })
      })
    })
  }, [mapReady, partners, themeRevision])

  useEffect(() => {
    if (!partnersSelected || !mapRef.current) return

    mapRef.current.flyTo(
      [partnersSelected.coordinates.latitude, partnersSelected.coordinates.longitude],
      14,
      { duration: 0.8 }
    )
  }, [partnersSelected])

  return (
    <section className={cn("overflow-hidden rounded-3xl border bg-card shadow-sm", className)}>
      <div className="border-b px-4 py-3 sm:px-5">
        <h2 className="font-black">Carte des partenaires</h2>
        <p id="map-instructions" className="text-sm text-muted-foreground">
          La Réunion · utilisez Tab pour parcourir les marqueurs, puis Entrée ou Espace pour afficher l&apos;adresse.
        </p>
      </div>
      <div
        ref={containerRef}
        className="h-[420px] w-full sm:h-[540px]"
        aria-label="Carte interactive centrée sur La Réunion"
        aria-describedby="map-instructions"
      />
    </section>
  )
}
