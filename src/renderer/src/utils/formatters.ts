export const fmtDate = (d: string): string => {
    if (!d) return "—";
    const [y, m, day] = d.slice(0, 10).split("-");
    return y && m && day ? `${parseInt(day)}. ${parseInt(m)}. ${y}` : d;
};

export const fmtCurrency = (n: number, currency: string): string =>
    new Intl.NumberFormat("sk-SK", { style: "currency", currency, minimumFractionDigits: 2 }).format(n);
