import { Box } from '@mui/material'
import type { MeFilterType } from './types'

interface MeFilterTabsProps {
  filter: MeFilterType
  filters: Array<{ id: MeFilterType; label: string }>
  onChange: (filter: MeFilterType) => void
}

export const MeFilterTabs = ({
  filter,
  filters,
  onChange,
}: MeFilterTabsProps) => (
  <Box sx={{ display: 'flex', gap: '8px', px: '20px', py: '14px', overflowX: 'auto', '&::-webkit-scrollbar': { display: 'none' } }}>
    {filters.map((item) => {
      const active = item.id === filter
      return (
        <Box
          key={item.id}
          component="button"
          type="button"
          onClick={() => onChange(item.id)}
          sx={{
            px: '14px',
            py: '6px',
            borderRadius: '999px',
            border: '1px solid',
            borderColor: active ? 'rgba(110,96,238,0.4)' : 'rgba(255,255,255,0.07)',
            bgcolor: active ? 'rgba(110,96,238,0.25)' : '#1a1a2c',
            color: active ? 'primary.light' : 'text.secondary',
            fontSize: '13px',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
            transition: 'all 0.15s',
            '&:hover': active
              ? undefined
              : {
                  borderColor: 'rgba(255,255,255,0.13)',
                  color: 'text.primary',
                },
          }}
        >
          {item.label}
        </Box>
      )
    })}
  </Box>
)

