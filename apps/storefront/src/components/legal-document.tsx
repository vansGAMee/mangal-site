import Link from "next/link";

export function LegalDocument({ title, version, children }: { title: string; version: string; children: React.ReactNode }) {
  return <article className="legal-copy shell max-w-4xl py-16"><Link href="/" className="eyebrow">← На главную</Link><div className="my-8 border border-[var(--copper)] p-5 text-sm leading-6 text-[var(--copper)]">Шаблон версии {version}. Не является утверждённым юридическим текстом. Публикация production заблокирована до проверки юристом и фиксации утверждённого SHA‑256.</div><h1>{title}</h1>{children}</article>;
}
