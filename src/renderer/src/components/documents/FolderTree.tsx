import { useState } from 'react'
import { Box, Collapse, Stack, Typography } from '@mui/material'
import { ExpandLess, ExpandMore, FolderOpen, InsertDriveFile } from '@mui/icons-material'
import type { FolderNode } from '../../utils/documentUtils'
import { fmtSize } from '../../utils/documentUtils'

type Props = {
    node: FolderNode
    depth?: number
}

export const FolderTree = ({ node, depth = 0 }: Props) => {
    const [open, setOpen] = useState(true)
    const indent = depth * 16
    return (
        <Box>
            {node.name && (
                <Stack direction="row" alignItems="center" gap={0.5}
                    onClick={() => setOpen(o => !o)}
                    sx={{ cursor: 'pointer', pl: `${8 + indent}px`, pr: 1, py: 0.25, '&:hover': { bgcolor: 'action.hover' } }}
                >
                    {open ? <ExpandLess fontSize="small" color="action" /> : <ExpandMore fontSize="small" color="action" />}
                    <FolderOpen fontSize="small" color="warning" />
                    <Typography variant="body2" fontWeight={600}>{node.name}</Typography>
                </Stack>
            )}
            <Collapse in={!node.name || open}>
                {node.files.map((f, i) => (
                    <Stack key={i} direction="row" alignItems="center" gap={0.5}
                        sx={{ pl: `${8 + indent + (node.name ? 24 : 0)}px`, pr: 2, py: 0.25 }}
                    >
                        <InsertDriveFile fontSize="small" sx={{ color: 'text.disabled', fontSize: 16 }} />
                        <Typography variant="body2" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {f.file.name}
                        </Typography>
                        <Typography variant="caption" color="text.disabled" sx={{ whiteSpace: 'nowrap' }}>
                            {fmtSize(f.file.size)}
                        </Typography>
                    </Stack>
                ))}
                {Array.from(node.children.values()).map(child => (
                    <FolderTree key={child.name} node={child} depth={depth + (node.name ? 1 : 0)} />
                ))}
            </Collapse>
        </Box>
    )
}
