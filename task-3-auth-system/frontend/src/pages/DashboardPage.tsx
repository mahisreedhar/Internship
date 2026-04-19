import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  clearAuthToken,
  fetchMe,
  getAuthToken,
  getErrorMessage,
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
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
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

  const progressPercentage = Math.min(100, Math.max(0, (sessionMinutes / 60) * 100))
  const sessionTimeText = `${sessionMinutes}m`
  const progressStyle = {
    '--progress': `${progressPercentage}%`,
  } as CSSProperties

  return (
    <main className="dashboard-page">
      <section className="terminal-console">
        <header className="console-header">
          <div className="micro-display-group" aria-hidden="true">
            <div className="micro-display">
              <p>boot::0x7A3 [ok]</p>
              <p>uplink::stable</p>
            </div>
            <div className="micro-display">
              <p>flux.map#42</p>
              <p>net.route :: live</p>
            </div>
          </div>

          <div className="console-meta">
            <p className="console-label">DASHBOARD</p>
            <p className="console-tag">
              <span className="status-dot" aria-hidden="true"></span>
              SYSTEMS: OPTIMAL
            </p>
          </div>
        </header>

        <h1 className="session-title">YOUR SESSION</h1>
        <p className="session-subtitle">
          Protected space online. Signals are stable and your session remains active.
        </p>

        <section className="module-row" aria-label="command modules">
          <article className="module module-notification">
            <p className="module-title">
              <span className="module-icon" aria-hidden="true">
                🔔
              </span>
              NOTIFICATIONS
            </p>
            <p className="module-caption">1 pending</p>
          </article>

          <article className="module module-activity">
            <p className="module-title">activity activity activity activities ACTIVITY LOG</p>
            <div className="activity-graph" aria-hidden="true">
              <div className="graph-axis graph-axis-y">
                <span>100</span>
                <span>50</span>
                <span>0</span>
              </div>
              <div className="graph-bars">
                <span className="bar b1"></span>
                <span className="bar b2"></span>
                <span className="bar b3"></span>
                <span className="bar b4"></span>
                <span className="bar b5"></span>
              </div>
              <div className="graph-axis graph-axis-x">
                <span>00</span>
                <span>04</span>
                <span>08</span>
                <span>12</span>
                <span>16</span>
              </div>
            </div>
          </article>

          <article className="module module-session-time">
            <div className="time-ring" style={progressStyle}>
              <span>{sessionTimeText}</span>
            </div>
            <p className="module-caption">ACTIVE SESSION TIME</p>
          </article>
        </section>

        <section className="identity-strip">
          <div className="circuit-avatar" aria-hidden="true">
            <span className="head"></span>
            <span className="node node-a"></span>
            <span className="node node-b"></span>
            <span className="node node-c"></span>
          </div>
          <p className="session-email">{email || 'mahi@example.com'}</p>
        </section>

        {isLoading ? <p className="status muted dashboard-status">Calibrating profile...</p> : null}
        {!isLoading && error ? <p className="status error dashboard-status">{error}</p> : null}

        <footer className="console-footer">
          <button className="exit-button" type="button" onClick={handleLogout}>
            <span className="exit-icon" aria-hidden="true">
              ⎋
            </span>
            <span>EXIT</span>
          </button>
          <span className="safety-tag">SAFETY TAG</span>
        </footer>

        <span className="console-artifact artifact-key" aria-hidden="true">
          🔑
        </span>
        <span className="console-artifact artifact-rocket" aria-hidden="true">
          🚀
        </span>
      </section>
    </main>
  )
}
