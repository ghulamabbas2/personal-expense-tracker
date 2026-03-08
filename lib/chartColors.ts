export function getChartColors(theme: "light" | "dark") {
  const isDark = theme === "dark"

  return {
    primary: isDark ? "#7c3aed" : "#6d28d9",
    success: isDark ? "#17c964" : "#12a150",
    danger: isDark ? "#f31260" : "#c20a4b",
    warning: isDark ? "#f5a524" : "#d97706",

    categories: {
      Food: "#f97316",
      Transport: "#3b82f6",
      Housing: "#8b5cf6",
      Entertainment: "#ec4899",
      Health: "#22c55e",
      Shopping: "#f59e0b",
      Other: "#6b7280",
    } as Record<string, string>,

    gridLine: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
    tickLabel: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)",

    tooltipBg: isDark ? "#18181b" : "#ffffff",
    tooltipBorder: isDark ? "#3f3f46" : "#e4e4e7",
    tooltipText: isDark ? "#fafafa" : "#18181b",
  }
}
