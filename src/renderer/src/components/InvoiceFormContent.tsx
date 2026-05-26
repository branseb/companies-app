import { FormControlLabel, Grid, Switch, TextField } from '@mui/material'
import type { SimpleInvoice } from '../models/SimpleInvoice'
import { CurrencySelect } from './currencySelect'
import { PartyAutocomplete } from './PartyAutocomplete'
import { FormSection } from './FormSection'
import { InvoiceItemsEditor } from './InvoiceItemsEditor'

type Props = {
  invoice: SimpleInvoice
  onChange: (inv: SimpleInvoice) => void
  vatEnabled: boolean
  onVatChange: (enabled: boolean) => void
  compact?: boolean
}

export function InvoiceFormContent({ invoice, onChange, vatEnabled, onVatChange, compact }: Props) {
  const spacing = compact ? 1.5 : 3
  // v compact móde: max 2 stĺpce, inak pôvodné breakpointy
  const c = (full: number, half = 6) =>
    compact ? { xs: 12, sm: half } : { xs: 12, sm: full }

  const set = <K extends keyof SimpleInvoice>(field: K, value: SimpleInvoice[K]) =>
    onChange({ ...invoice, [field]: value })

  const setCustomer = (field: keyof SimpleInvoice['customer'], value: string) =>
    onChange({ ...invoice, customer: { ...invoice.customer, [field]: value } })

  return (
    <Grid container spacing={spacing}>

      <FormSection title="Zákazník" spacing={spacing}>
        <Grid size={c(6)}>
          <PartyAutocomplete
            label="IČO"
            value={invoice.customer}
            onChange={customer => set('customer', customer)}
          />
        </Grid>
        <Grid size={c(6)}>
          <TextField label="Názov" fullWidth value={invoice.customer.name}
            onChange={e => setCustomer('name', e.target.value)} />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <TextField label="Ulica" fullWidth value={invoice.customer.address ?? ''}
            onChange={e => setCustomer('address', e.target.value)} />
        </Grid>
        <Grid size={c(3, 4)}>
          <TextField label="PSČ" fullWidth value={invoice.customer.zip ?? ''}
            onChange={e => setCustomer('zip', e.target.value)} />
        </Grid>
        <Grid size={c(9, 8)}>
          <TextField label="Mesto" fullWidth value={invoice.customer.city ?? ''}
            onChange={e => setCustomer('city', e.target.value)} />
        </Grid>
      </FormSection>

      <FormSection title="Faktúra" spacing={spacing}>
        <Grid size={c(6)}>
          <TextField label="Číslo faktúry" fullWidth value={invoice.invoiceNumber}
            onChange={e => set('invoiceNumber', e.target.value)} />
        </Grid>
        <Grid size={c(6)}>
          <CurrencySelect invoice={invoice} onChange={currency => set('currency', currency)} />
        </Grid>
        <Grid size={c(4, 6)}>
          <TextField label="Dátum vystavenia" type="date" fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
            value={invoice.issueDate}
            onChange={e => set('issueDate', e.target.value)} />
        </Grid>
        <Grid size={c(4, 6)}>
          <TextField label="Dátum splatnosti" type="date" fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
            value={invoice.dueDate || ''}
            onChange={e => set('dueDate', e.target.value)} />
        </Grid>
        <Grid size={c(4, 6)}>
          <TextField label="Dátum dodania" type="date" fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
            value={invoice.delivery?.actualDeliveryDate || ''}
            onChange={e => set('delivery', { actualDeliveryDate: e.target.value })} />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <FormControlLabel
            control={
              <Switch checked={vatEnabled} onChange={e => {
                const enabled = e.target.checked
                onVatChange(enabled)
                if (!enabled) set('items', (invoice.items ?? []).map(it => ({ ...it, taxRate: 0 })))
              }} />
            }
            label="Platca DPH"
          />
        </Grid>
      </FormSection>

      <FormSection title="Položky" spacing={spacing}>
        <Grid size={{ xs: 12 }}>
          <InvoiceItemsEditor
            items={invoice.items ?? []}
            onChange={items => set('items', items)}
            vatEnabled={vatEnabled}
            compact={compact}
          />
        </Grid>
      </FormSection>

    </Grid>
  )
}
