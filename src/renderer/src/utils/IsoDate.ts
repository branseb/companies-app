export const toISODate = (date: string) => {
    if (!date) return "";

    if (date.includes("-") && date.length === 10) return date;

    const [d, m, y] = date.split(".");
    if (d && m && y) {
        return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }

    return date;
};