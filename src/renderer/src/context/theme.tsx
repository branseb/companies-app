import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createTheme, CssBaseline, ThemeProvider } from "@mui/material";

type Mode = "light" | "dark";

const ThemeModeContext = createContext<{ mode: Mode; toggleMode: () => void } | null>(null);

const scrollbarStyles = (dark: boolean) => {
    const thumb      = dark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)'
    const thumbHover = dark ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.34)'
    return `
        * { scrollbar-width: thin; scrollbar-color: ${thumb} transparent; }
        *::-webkit-scrollbar { width: 6px; height: 6px; }
        *::-webkit-scrollbar-button { display: none !important; height: 0 !important; width: 0 !important; }
        *::-webkit-scrollbar-track { background: transparent; }
        *::-webkit-scrollbar-thumb {
            background: ${thumb};
            border-radius: 99px;
        }
        *::-webkit-scrollbar-thumb:hover { background: ${thumbHover}; }
    `
}

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

    const theme = useMemo(() => createTheme({
        palette: {
            mode,
            primary: { main: '#6366F1' },
        },
    }), [mode]);

    useEffect(() => {
        const id = '__scrollbar_override__'
        let el = document.getElementById(id) as HTMLStyleElement | null
        if (!el) {
            el = document.createElement('style')
            el.id = id
            document.head.appendChild(el)
        }
        el.textContent = scrollbarStyles(mode === 'dark')
    }, [mode])

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
