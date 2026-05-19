import { useState, useEffect } from 'react'
import {
  Box, TextField, IconButton, Typography, Paper, Stack,
  CircularProgress, InputAdornment, Alert, Button,
} from '@mui/material'
import { Send } from '@mui/icons-material'
import { useFirebaseAuth } from '../context/firebaseAuth'
import { useChat } from '../hooks/useChat'

function formatTime(date: Date) {
  return date.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })
}
function formatDate(date: Date) {
  const today = new Date()
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Dnes'
  if (date.toDateString() === yesterday.toDateString()) return 'Včera'
  return date.toLocaleDateString('sk-SK', { day: 'numeric', month: 'long' })
}

function ChatView({ companyId }: { companyId: string }) {
  const { messages, loading, sendMessage, markAllAsRead } = useChat(companyId, 'accountant')
  const [text, setText]   = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (messages.length > 0) markAllAsRead()
  }, [messages])

  async function handleSend() {
    if (!text.trim() || sending) return
    setSending(true)
    try { await sendMessage(text); setText('') }
    finally { setSending(false) }
  }

  const groups: { date: string; msgs: typeof messages }[] = []
  for (const msg of messages) {
    const label = formatDate(msg.timestamp)
    const last = groups[groups.length - 1]
    if (last?.date === label) last.msgs.push(msg)
    else groups.push({ date: label, msgs: [msg] })
  }

  if (loading) return <Box display="flex" alignItems="center" justifyContent="center" flex={1}><CircularProgress /></Box>

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ flex: 1, overflowY: 'auto', pr: 1 }}>
        {messages.length === 0 && (
          <Box display="flex" alignItems="center" justifyContent="center" height="100%">
            <Typography color="text.secondary" fontSize={14}>Žiadne správy.</Typography>
          </Box>
        )}
        {groups.map(group => (
          <Box key={group.date}>
            <Box display="flex" alignItems="center" gap={1} my={2}>
              <Box flex={1} height="1px" bgcolor="divider" />
              <Typography variant="caption" color="text.secondary">{group.date}</Typography>
              <Box flex={1} height="1px" bgcolor="divider" />
            </Box>
            <Stack gap={0.75}>
              {group.msgs.map(msg => {
                const isMe = msg.from === 'accountant'
                return (
                  <Box key={msg.id} display="flex" justifyContent={isMe ? 'flex-end' : 'flex-start'}>
                    <Box sx={{ maxWidth: '70%' }}>
                      {!isMe && <Typography variant="caption" color="text.secondary" px={1}>Firma</Typography>}
                      <Paper elevation={0} sx={{
                        px: 1.5, py: 1,
                        bgcolor: isMe ? 'primary.main' : 'action.selected',
                        color: isMe ? 'primary.contrastText' : 'text.primary',
                        borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      }}>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {msg.text}
                        </Typography>
                      </Paper>
                      <Typography variant="caption" color="text.secondary" display="block"
                        textAlign={isMe ? 'right' : 'left'} px={1}>
                        {formatTime(msg.timestamp)}
                      </Typography>
                    </Box>
                  </Box>
                )
              })}
            </Stack>
          </Box>
        ))}
      </Box>
      <Box pt={2}>
        <TextField fullWidth multiline maxRows={4}
          placeholder="Napíšte správu… (Enter = odoslať)"
          value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          disabled={sending} size="small"
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={handleSend} disabled={!text.trim() || sending} color="primary">
                  <Send />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      </Box>
    </Box>
  )
}

function FirebaseLogin() {
  const { fbSignIn } = useFirebaseAuth()
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true)
    try { await fbSignIn(email, password) }
    catch { setError('Nesprávny email alebo heslo') }
    finally { setLoading(false) }
  }

  return (
    <Box display="flex" alignItems="center" justifyContent="center" height="100%">
      <Paper sx={{ p: 4, width: 340 }}>
        <Typography variant="h6" fontWeight={700} mb={1}>Prihlásenie do chatu</Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Zadajte vaše Firebase prihlasovacie údaje (rovnaké ako na portáli).
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Box component="form" onSubmit={handleLogin} display="flex" flexDirection="column" gap={2}>
          <TextField label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required fullWidth size="small" />
          <TextField label="Heslo" type="password" value={password} onChange={e => setPassword(e.target.value)} required fullWidth size="small" />
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? 'Prihlásovanie…' : 'Prihlásiť sa'}
          </Button>
        </Box>
      </Paper>
    </Box>
  )
}

export function ChatPage({ companyId }: { companyId: string }) {
  const { fbUser, fbLoading } = useFirebaseAuth()

  if (fbLoading) return <Box display="flex" alignItems="center" justifyContent="center" height="100%"><CircularProgress /></Box>
  if (!fbUser)   return <FirebaseLogin />

  return <ChatView companyId={companyId} />
}
