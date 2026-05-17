'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import '../auth.css'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setSubmitting(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="auth-root">
      <div className="auth-card">
        <Link href="/landing" className="auth-logo">PULSE</Link>
        <h1 className="auth-heading">Sign in</h1>
        <p className="auth-sub">Welcome back to Pulse.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="auth-field-label">Email</label>
            <input
              id="email"
              type="email"
              className="auth-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="password" className="auth-field-label">Password</label>
            <input
              id="password"
              type="password"
              className="auth-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="auth-button" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>

          {error && <div className="auth-error">{error}</div>}
        </form>

        <p className="auth-foot">
          No account?<Link href="/auth/signup">Sign up →</Link>
        </p>
      </div>
    </div>
  )
}
