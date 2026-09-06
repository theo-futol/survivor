"use client"

import { useCallback, useEffect, useState } from "react"

import { apiFetch, type MeResponse } from "@/lib/api-client"

let currentUserRequest: Promise<MeResponse> | null = null

function fetchCurrentUser() {
  if (!currentUserRequest) {
    currentUserRequest = apiFetch<MeResponse>("/api/v1/me").finally(() => {
      currentUserRequest = null
    })
  }

  return currentUserRequest
}

export function useCurrentUser() {
  const [data, setData] = useState<MeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await fetchCurrentUser())
    } catch (caught) {
      setData(null)
      setError(caught instanceof Error ? caught.message : "Impossible de charger la session.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, loading, error, reload }
}
