import { Alert, Snackbar } from "@mui/material";
import { useEffect, useState } from "react";

export const GlobalErrorSnackbar = () => {
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handler = (e: PromiseRejectionEvent) => {
            e.preventDefault();
            const msg = e.reason?.message ?? String(e.reason ?? "Neznáma chyba");
            setError(msg);
        };
        window.addEventListener("unhandledrejection", handler);
        return () => window.removeEventListener("unhandledrejection", handler);
    }, []);

    return (
        <Snackbar
            open={!!error}
            autoHideDuration={6000}
            onClose={() => setError(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
            <Alert severity="error" onClose={() => setError(null)} sx={{ maxWidth: 500 }}>
                {error}
            </Alert>
        </Snackbar>
    );
};
