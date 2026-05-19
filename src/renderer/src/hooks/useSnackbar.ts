import { useState } from "react";

interface SnackbarState {
    open: boolean;
    message: string;
    severity: "success" | "error";
}

export function useSnackbar() {
    const [snackbar, setSnackbar] = useState<SnackbarState>({ open: false, message: "", severity: "success" });

    const showSnackbar = (message: string, severity: "success" | "error" = "success") =>
        setSnackbar({ open: true, message, severity });

    const closeSnackbar = () => setSnackbar(s => ({ ...s, open: false }));

    return { snackbar, showSnackbar, closeSnackbar };
}
