import { useEffect, useState } from 'react'
import { Box, InputBase, Typography } from '@mui/material'
import { EditNote } from '@mui/icons-material'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'

type Props = {
    docId: string
    note: string
    companyId: string
}

export const NoteCell = ({ docId, note, companyId }: Props) => {
    const [editing, setEditing] = useState(false)
    const [value, setValue] = useState(note)

    useEffect(() => { if (!editing) setValue(note) }, [note, editing])

    const save = () => {
        setEditing(false)
        if (value !== note)
            updateDoc(doc(db, 'companies', companyId, 'documents', docId), { note: value })
    }

    if (editing) {
        return (
            <InputBase
                value={value}
                onChange={e => setValue(e.target.value)}
                onBlur={save}
                onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setValue(note); setEditing(false) } }}
                autoFocus
                fullWidth
                sx={{ fontSize: '0.875rem', minWidth: 140 }}
                placeholder="Poznámka..."
            />
        )
    }

    return (
        <Box onClick={() => setEditing(true)} sx={{
            display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'text',
            '&:hover .ni': { opacity: 1 }, minWidth: 100,
        }}>
            <Typography variant="body2" noWrap sx={{ maxWidth: 160, color: note ? 'text.primary' : 'text.disabled' }}>
                {note || '—'}
            </Typography>
            <EditNote className="ni" sx={{ fontSize: 14, opacity: 0, color: 'text.secondary', flexShrink: 0 }} />
        </Box>
    )
}
