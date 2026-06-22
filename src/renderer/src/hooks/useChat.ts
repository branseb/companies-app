import { db } from '../firebase/config'
import { useChat as useChatShared } from '@e-companies/shared'
export type { ChatMessage } from '@e-companies/shared'

export const useChat = (
  companyId: string,
  myRole: 'company' | 'accountant',
  enabled = true,
) => useChatShared(db, companyId, myRole, enabled)
