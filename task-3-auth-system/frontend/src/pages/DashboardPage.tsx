import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  clearAuthToken,
  fetchMe,
  getAuthToken,
  getErrorMessage,
  isUnauthorizedError,
} from '../api/auth'

export function DashboardPage() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = getAuthToken()
    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    let isCurrent = true

    const loadProfile = async () => {
      setIsLoading(true)
      setError('')

      try {
        const me = await fetchMe(token)
        if (isCurrent) {
          setEmail(me.email)
        }
      } catch (fetchError) {
        if (isUnauthorizedError(fetchError)) {
          clearAuthToken()
          navigate('/login', { replace: true })
          return
        }

        if (isCurrent) {
          setError(getErrorMessage(fetchError))
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false)
        }
      }
    }

    void loadProfile()

    return () => {
      isCurrent = false
    }
  }, [navigate])

  const handleLogout = () => {
    clearAuthToken()
    navigate('/login', { replace: true })
  }

  return (
    <main className="dashboard-page">
      <span className="fiber-thread fiber-thread-left" aria-hidden="true"></span>
      <span className="fiber-thread fiber-thread-right" aria-hidden="true"></span>

      <span className="crystal crystal-one" aria-hidden="true"></span>
      <span className="crystal crystal-two" aria-hidden="true"></span>
      <span className="crystal crystal-three" aria-hidden="true"></span>

      <span className="float-icon float-rocket" aria-hidden="true">
        🚀
      </span>
      <span className="float-icon float-key" aria-hidden="true">
        🔑
      </span>

      <section className="session-panel">
        <header className="panel-top">
          <div className="panel-avatar" aria-hidden="true">
            <span></span>
          </div>
          <div>
            <p className="panel-label">DASHBOARD</p>
            <p className="panel-tag">SYSTEMS: OPTIMAL</p>
          </div>
        </header>

        <h1 className="session-title">YOUR SESSION</h1>
        <p className="session-subtitle">
          Protected space online. Signals are stable and your session remains active.
        </p>

        <section className="widget-row" aria-label="session widgets">
          <article className="widget widget-bell">
            <span className="widget-icon" aria-hidden="true">
              🔔
            </span>
            <p>Notifications</p>
          </article>

          <article className="widget widget-graph" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </article>

          <article className="widget widget-time">
            <p className="time-value">15m</p>
            <p>session time</p>
          </article>
        </section>

        {isLoading ? <p className="status muted dashboard-status">Calibrating profile...</p> : null}
        {!isLoading && error ? <p className="status error dashboard-status">{error}</p> : null}
        {!isLoading && !error ? (
          <p className="session-email">{email || 'mahi@example.com'}</p>
        ) : null}

        <div className="exit-wrap">
          <button className="exit-stone-button" type="button" onClick={handleLogout}>
            <span className="exit-icon" aria-hidden="true">
              ↪
            </span>
            <span>EXIT</span>
          </button>
        </div>
      </section>
    </main>
  )
}
