import { useEffect, useState, useRef } from 'react'
import {
  collection, addDoc, onSnapshot, orderBy,
  query, serverTimestamp, updateDoc, doc,
} from 'firebase/firestore'
import { db } from '../firebase/config'

export type ChatMessage = {
  id: string
  text: string
  from: 'company' | 'accountant'
  timestamp: Date
  readByAccountant: boolean
  readByCompany: boolean
}

export function useChat(companyId: string, myRole: 'company' | 'accountant', enabled = true) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading]   = useState(true)
  const unsubRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!companyId || !enabled) { setLoading(false); return }

    const q = query(
      collection(db, 'companies', companyId, 'messages'),
      orderBy('timestamp', 'asc'),
    )

    unsubRef.current = onSnapshot(q,
      snap => {
        const msgs: ChatMessage[] = snap.docs.map(d => ({
          id:               d.id,
          text:             d.data().text,
          from:             d.data().from,
          timestamp:        d.data().timestamp?.toDate() ?? new Date(),
          readByAccountant: d.data().readByAccountant ?? false,
          readByCompany:    d.data().readByCompany ?? false,
        }))
        setMessages(msgs)
        setLoading(false)
      },
      err => {
        console.error('[useChat] Firestore error:', err.message)
        setLoading(false)
      }
    )

    return () => unsubRef.current?.()
  }, [companyId, myRole])

  async function sendMessage(text: string) {
    if (!text.trim() || !companyId) return
    await addDoc(collection(db, 'companies', companyId, 'messages'), {
      text:             text.trim(),
      from:             myRole,
      timestamp:        serverTimestamp(),
      readByAccountant: myRole === 'accountant',
      readByCompany:    myRole === 'company',
    })
  }

  async function markAllAsRead() {
    const readField = myRole === 'company' ? 'readByCompany' : 'readByAccountant'
    const unread = messages.filter(m => m.from !== myRole && !m[readField as keyof ChatMessage])
    for (const msg of unread) {
      await updateDoc(doc(db, 'companies', companyId, 'messages', msg.id), { [readField]: true })
    }
  }

  return { messages, loading, sendMessage, markAllAsRead }
}
