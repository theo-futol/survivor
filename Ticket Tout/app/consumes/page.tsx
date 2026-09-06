import { redirect } from "next/navigation"

export default function ConsumesPage() {
  redirect("/transactions?filter=consumed")
}
