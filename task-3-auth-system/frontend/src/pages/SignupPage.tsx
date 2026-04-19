import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { getAuthToken, getErrorMessage, signup } from '../api/auth'
import { AuthCard } from '../components/AuthCard'

export function SignupPage() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
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
      setSuccessMessage('')
      return
    }

    setError('')
    setSuccessMessage('')
    setIsSubmitting(true)

    try {
      await signup({ email: normalizedEmail, password })
      setSuccessMessage('Account created. You can log in now.')
      setPassword('')
    } catch (fetchError) {
      setError(getErrorMessage(fetchError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthCard
      title="Create Account"
      subtitle="Sign up to get started with your private dashboard."
      footerText="Already registered?"
      footerLinkTo="/login"
      footerLinkLabel="Login"
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="signup-email">Email</label>
          <input
            id="signup-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="signup-password">Password</label>
          <input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            placeholder="Create a password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>

        <button className="button button-primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Sign Up'}
        </button>
      </form>

      {error ? <p className="status error">{error}</p> : null}
      {successMessage ? <p className="status success">{successMessage}</p> : null}
    </AuthCard>
  )
}
