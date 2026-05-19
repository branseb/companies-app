import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { type User, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { auth } from '../firebase/config'

interface FirebaseAuthContextValue {
  fbUser: User | null
  fbLoading: boolean
  fbSignIn: (email: string, password: string) => Promise<void>
  fbSignOut: () => Promise<void>
}

const FirebaseAuthContext = createContext<FirebaseAuthContextValue>({
  fbUser: null,
  fbLoading: true,
  fbSignIn: async () => {},
  fbSignOut: async () => {},
})

export function FirebaseAuthProvider({ children }: { children: ReactNode }) {
  const [fbUser, setFbUser]       = useState<User | null>(null)
  const [fbLoading, setFbLoading] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, user => {
      setFbUser(user)
      setFbLoading(false)
    })
  }, [])

  async function fbSignIn(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password)
  }

  async function fbSignOut() {
    await signOut(auth)
  }

  return (
    <FirebaseAuthContext.Provider value={{ fbUser, fbLoading, fbSignIn, fbSignOut }}>
      {children}
    </FirebaseAuthContext.Provider>
  )
}

export const useFirebaseAuth = () => useContext(FirebaseAuthContext)
