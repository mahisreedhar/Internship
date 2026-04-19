import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { getErrorMessage, getAuthToken, login, setAuthToken } from '../api/auth'
import { AuthCard } from '../components/AuthCard'

export function LoginPage() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (getAuthToken()) {
      navigate('/dashboard', { replace: true })
    }
  }, [navigate])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail || !password) {
      setError('Email and password are required.')
      return
    }

    setError('')
    setIsSubmitting(true)

    try {
      const response = await login({ email: normalizedEmail, password })
      setAuthToken(response.access_token)
      navigate('/dashboard', { replace: true })
    } catch (fetchError) {
      setError(getErrorMessage(fetchError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthCard
      title="Welcome Back"
      subtitle="Log in to open your dashboard."
      footerText="Need an account?"
      footerLinkTo="/signup"
      footerLinkLabel="Create one"
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>

        <button className="button button-primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Signing In...' : 'Login'}
        </button>
      </form>

      {error ? <p className="status error">{error}</p> : null}
    </AuthCard>
  )
}
