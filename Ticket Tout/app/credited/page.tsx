import { redirect } from "next/navigation"

export default function CreditedPage() {
  redirect("/transactions?filter=credited")
}
