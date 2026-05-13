import React, { useEffect, useState } from "react";
import { Autocomplete, TextField, Typography, Box } from "@mui/material";
import type { Party } from "../models/SimpleInvoice";

interface Props {
    value: Party;
    onChange: (party: Party) => void;
    label?: string;
}

export const PartyAutocomplete: React.FC<Props> = ({ value, onChange, label = "IČO" }) => {
    const [options, setOptions] = useState<Party[]>([]);

    useEffect(() => {
        window.api.invoice.knownParties().then(setOptions);
    }, []);

    const selected = options.find(o => o.ico === value.ico) ?? null;

    return (
        <Autocomplete
            options={options}
            value={selected}
            getOptionLabel={o => typeof o === "string" ? o : (o.ico ?? "")}
            isOptionEqualToValue={(o, v) => o.ico === v.ico}
            onChange={(_e, party) => {
                if (!party || typeof party === "string") return;
                onChange({
                    name: party.name,
                    ico: party.ico,
                    icDph: party.icDph,
                    address: party.address,
                    city: party.city,
                    zip: party.zip,
                    country: party.country,
                });
            }}
            freeSolo
            inputValue={value.ico ?? ""}
            onInputChange={(_e, ico) => onChange({ ...value, ico })}
            renderOption={(props, o) => (
                <Box component="li" {...props} key={typeof o === "string" ? o : o.ico}>
                    <Typography variant="body2" fontWeight={600} sx={{ mr: 1 }}>{typeof o === "string" ? o : o.ico}</Typography>
                    <Typography variant="body2" color="text.secondary">{typeof o === "string" ? "" : o.name}</Typography>
                </Box>
            )}
            renderInput={params => <TextField {...params} label={label} fullWidth />}
        />
    );
};
