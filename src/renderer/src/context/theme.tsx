import { createContext, useContext, useMemo, useState } from "react";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { createAppTheme } from "@e-companies/shared";

type Mode = "light" | "dark";

const ThemeModeContext = createContext<{ mode: Mode; toggleMode: () => void } | null>(null);

export const AppThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const [mode, setMode] = useState<Mode>(
        () => (localStorage.getItem("colorMode") as Mode | null) ?? "light"
    );

    const toggleMode = () => {
        setMode(prev => {
            const next = prev === "light" ? "dark" : "light";
            localStorage.setItem("colorMode", next);
            return next;
        });
    };

    const theme = useMemo(() => createAppTheme(mode), [mode]);

    return (
        <ThemeModeContext.Provider value={{ mode, toggleMode }}>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                {children}
            </ThemeProvider>
        </ThemeModeContext.Provider>
    );
};

export const useThemeMode = () => {
    const ctx = useContext(ThemeModeContext);
    if (!ctx) throw new Error("useThemeMode must be inside AppThemeProvider");
    return ctx;
};
