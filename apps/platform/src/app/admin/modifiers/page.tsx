import { AdminModifierEditor } from "@/components/admin-modifier-editor";
import { AdminNav } from "@/components/admin-nav";

export default function Page() {
  return <main className="admin-shell"><AdminNav /><AdminModifierEditor /></main>;
}
