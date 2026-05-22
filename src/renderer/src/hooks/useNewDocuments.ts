import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase/config'

export function useNewDocuments(companyId: string, enabled = true): string[] | null {
  const [ids, setIds] = useState<string[] | null>(null)

  useEffect(() => {
    if (!companyId || !enabled) return

    const q = query(
      collection(db, 'companies', companyId, 'documents'),
      where('uploadedBy', '==', 'company'),
      where('status', '==', 'uploaded'),
    )

    return onSnapshot(q, snap => setIds(snap.docs.map(d => d.id)), () => setIds([]))
  }, [companyId, enabled])

  return ids
}
