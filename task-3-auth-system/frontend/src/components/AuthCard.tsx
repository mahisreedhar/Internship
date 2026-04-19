import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

type AuthCardProps = {
  title: string
  subtitle?: string
  footerText: string
  footerLinkTo: string
  footerLinkLabel: string
  children: ReactNode
}

export function AuthCard({
  title,
  subtitle,
  footerText,
  footerLinkTo,
  footerLinkLabel,
  children,
}: AuthCardProps) {
  return (
    <main className="page">
      <section className="auth-card">
        <p className="eyebrow">Auth System</p>
        <h1>{title}</h1>
        {subtitle ? <p className="auth-subtitle">{subtitle}</p> : null}
        {children}
        <p className="auth-footer">
          {footerText} <Link to={footerLinkTo}>{footerLinkLabel}</Link>
        </p>
      </section>
    </main>
  )
}
