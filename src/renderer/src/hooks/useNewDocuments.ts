import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase/config'

export function useNewDocuments(companyId: string, enabled = true): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!companyId || !enabled) return

    const q = query(
      collection(db, 'companies', companyId, 'documents'),
      where('uploadedBy', '==', 'company'),
      where('status', '==', 'uploaded'),
    )

    return onSnapshot(q, snap => setCount(snap.size), () => setCount(0))
  }, [companyId, enabled])

  return count
}
