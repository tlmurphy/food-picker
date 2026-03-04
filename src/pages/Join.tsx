import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { nanoid } from 'nanoid'
import { supabase } from '../lib/supabase'
import { useUser } from '../hooks/useUser'
import type { SessionUser } from '../types'

type Step = 'landing' | 'join-code' | 'name'

export default function Join() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('landing')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { saveUser } = useUser(pendingSessionId ?? undefined)

  async function handleCreate() {
    setLoading(true)
    setError('')
    const sessionId = nanoid(6).toUpperCase()
    const { error: err } = await supabase.from('sessions').insert({ id: sessionId })
    setLoading(false)
    if (err) {
      setError('Failed to create session. Try again.')
      return
    }
    setPendingSessionId(sessionId)
    setStep('name')
  }

  async function handleJoin() {
    if (!code.trim()) return
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase
      .from('sessions')
      .select('id')
      .eq('id', code.trim().toUpperCase())
      .single()
    setLoading(false)
    if (err || !data) {
      setError('Session not found. Check the code and try again.')
      return
    }
    setPendingSessionId(data.id)
    setStep('name')
  }

  async function handleName() {
    if (!name.trim() || !pendingSessionId) return
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase
      .from('session_users')
      .insert({ session_id: pendingSessionId, name: name.trim() })
      .select()
      .single()
    setLoading(false)
    if (err || !data) {
      setError('Failed to join. Try again.')
      return
    }
    saveUser(data as SessionUser)
    navigate(`/${pendingSessionId}`)
  }

  return (
    <div className="join-page">
      <motion.div
        className="join-card"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="app-title">🍔 Food Picker</h1>
        <p className="app-subtitle">Pick where to eat, together.</p>

        {step === 'landing' && (
          <div className="button-group">
            <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>
              {loading ? 'Creating…' : 'Create Session'}
            </button>
            <button className="btn btn-secondary" onClick={() => setStep('join-code')}>
              Join Session
            </button>
          </div>
        )}

        {step === 'join-code' && (
          <div className="input-group">
            <label>Enter session code</label>
            <input
              className="input"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              autoFocus
            />
            <div className="button-group">
              <button className="btn btn-primary" onClick={handleJoin} disabled={loading || !code.trim()}>
                {loading ? 'Checking…' : 'Join'}
              </button>
              <button className="btn btn-ghost" onClick={() => setStep('landing')}>
                Back
              </button>
            </div>
          </div>
        )}

        {step === 'name' && (
          <div className="input-group">
            <label>Your name</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Trevor"
              maxLength={30}
              onKeyDown={(e) => e.key === 'Enter' && handleName()}
              autoFocus
            />
            {pendingSessionId && (
              <p className="session-code-hint">
                Session code: <strong>{pendingSessionId}</strong>
              </p>
            )}
            <button className="btn btn-primary" onClick={handleName} disabled={loading || !name.trim()}>
              {loading ? 'Joining…' : "Let's Go!"}
            </button>
          </div>
        )}

        {error && <p className="error-text">{error}</p>}
      </motion.div>
    </div>
  )
}
