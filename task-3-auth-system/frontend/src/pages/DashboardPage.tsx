import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  clearAuthToken,
  fetchMe,
  getAuthToken,
  getSessionStartedAt,
  isUnauthorizedError,
} from '../api/auth'

function getSessionMinutes(startedAt: number): number {
  const elapsedMs = Date.now() - startedAt
  return Math.max(0, Math.floor(elapsedMs / 60000))
}

export function DashboardPage() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [sessionMinutes, setSessionMinutes] = useState<number>(0)
  const sessionStartedAtRef = useRef<number | null>(null)

  useEffect(() => {
    const token = getAuthToken()
    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    const startedAt = getSessionStartedAt() ?? Date.now()
    sessionStartedAtRef.current = startedAt
    window.setTimeout(() => {
      setSessionMinutes(getSessionMinutes(startedAt))
    }, 0)

    let isCurrent = true

    const loadProfile = async () => {
      try {
        const me = await fetchMe(token)
        if (isCurrent) {
          setEmail(me.email)
        }
      } catch (fetchError) {
        if (isUnauthorizedError(fetchError)) {
          clearAuthToken()
          navigate('/login', { replace: true })
        }
      }
    }

    void loadProfile()

    return () => {
      isCurrent = false
    }
  }, [navigate])

  useEffect(() => {
    const updateSessionTimer = () => {
      if (!sessionStartedAtRef.current) {
        return
      }

      setSessionMinutes(getSessionMinutes(sessionStartedAtRef.current))
    }

    const intervalId = window.setInterval(updateSessionTimer, 15000)
    return () => window.clearInterval(intervalId)
  }, [])

  const handleLogout = () => {
    clearAuthToken()
    navigate('/login', { replace: true })
  }

  const sessionTimeText = `${sessionMinutes}m`

  return (
    <main className="dashboard-page">
      <section className="minimal-console">
        <h1 className="session-title">YOUR SESSION</h1>
        <section className="session-time-panel">
          <p className="session-time-value">{sessionTimeText}</p>
          <p className="session-time-label">ACTIVE SESSION TIME</p>
        </section>
        <p className="session-email">{email || 'mahi@example.com'}</p>
        <button className="exit-button" type="button" onClick={handleLogout}>
          EXIT
        </button>
      </section>
    </main>
  )
}
