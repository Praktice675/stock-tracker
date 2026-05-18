'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import '../auth.css'

export default function SignupPage() {
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    setSubmitting(false)

    if (error) {
      setError(error.message)
      return
    }

    setNotice('Check your email to confirm your account.')
  }

  return (
    <div className="auth-root">
      <div className="auth-card">
        <Link href="/landing" className="auth-logo" aria-label="Pulse home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logos/pulse-lockup.svg"
            alt="Pulse"
            height={32}
            style={{ display: "block", height: 32, width: "auto" }}
          />
        </Link>
        <h1 className="auth-heading">Create account</h1>
        <p className="auth-sub">Start tracking your portfolio.</p>

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
              placeholder="At least 6 characters"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>

          <div>
            <label htmlFor="confirm" className="auth-field-label">Confirm password</label>
            <input
              id="confirm"
              type="password"
              className="auth-input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter password"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>

          <button type="submit" className="auth-button" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </button>

          {error && <div className="auth-error">{error}</div>}
          {notice && <div className="auth-notice">{notice}</div>}
        </form>

        <p className="auth-foot">
          Already have an account?<Link href="/auth/login">Sign in →</Link>
        </p>
      </div>
    </div>
  )
}
