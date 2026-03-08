import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useUser } from '../hooks/useUser'
import { socket } from '../lib/socket'

type Step = 'landing' | 'join-code' | 'name'

export default function Join() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('landing')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { user, saveUser } = useUser(pendingSessionId ?? undefined)

  // Pick up ?join=<sessionId> from Game redirect when user is missing
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const joinId = params.get('join')
    if (joinId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPendingSessionId(joinId.toUpperCase())
      setStep('name')
    }
  }, [])

  function handleCreate() {
    setLoading(true)
    setError('')
    socket.send({ type: 'create_session' })

    const unsubscribe = socket.subscribe((msg) => {
      if (msg.type === 'session_created') {
        unsubscribe()
        setLoading(false)
        setPendingSessionId(msg.sessionId)
        setStep('name')
      } else if (msg.type === 'error') {
        unsubscribe()
        setLoading(false)
        setError('Failed to create session. Try again.')
      }
    })
  }

  function handleJoin() {
    if (!code.trim()) return
    setPendingSessionId(code.trim().toUpperCase())
    setStep('name')
  }

  function handleName() {
    if (!name.trim() || !pendingSessionId) return
    setLoading(true)
    setError('')

    socket.send({
      type: 'join_session',
      sessionId: pendingSessionId,
      userId: user?.id ?? '',
      userName: user?.name ?? name.trim(),
    })

    const unsubscribe = socket.subscribe((msg) => {
      if (msg.type === 'session_state') {
        unsubscribe()
        setLoading(false)
        // Reconnect: match by existing id; new join: take last in list
        const ourUser = user?.id
          ? (msg.users.find((u) => u.id === user.id) ?? msg.users[msg.users.length - 1])
          : msg.users[msg.users.length - 1]
        saveUser(ourUser)
        void navigate(`/${pendingSessionId}`)
      } else if (msg.type === 'error') {
        unsubscribe()
        setLoading(false)
        setError(msg.message)
      }
    })
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
              placeholder="AB12CD34EF"
              maxLength={10}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              autoFocus
            />
            <div className="button-group">
              <button className="btn btn-primary" onClick={handleJoin} disabled={!code.trim()}>
                Join
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

        {error && (
          <>
            <p className="error-text">{error}</p>
            <div className="button-group">
              <button className="btn btn-primary" onClick={() => { setError(''); handleCreate() }}>
                Create New Session
              </button>
              <button className="btn btn-ghost" onClick={() => { setError(''); setStep('join-code') }}>
                Enter Different Code
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  )
}
