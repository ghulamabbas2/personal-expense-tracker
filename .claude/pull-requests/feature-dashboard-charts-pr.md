# Pull Request: Add interactive charts to dashboard for expense visualization

**Branch:** `feature/dashboard-charts` → `main`
**Date:** 2026-03-08
**Author:** ghulamabbas2

---

## Summary
- Add bar and doughnut charts to the dashboard to visualize monthly spending trends and category breakdowns
- Implement light/dark mode toggle in the navbar with theme-aware chart styling
- Add shared chart color palette and documentation spec for charts

## Changes
- `components/charts/MonthlyBarChart.tsx`: New reusable bar chart component using react-chartjs-2
- `components/charts/SpendingDoughnutChart.tsx`: New doughnut chart for category spending breakdown
- `app/(dashboard)/_components/MonthlyTrendChart.tsx`: Dashboard wrapper for monthly bar chart
- `app/(dashboard)/_components/SpendingByCategory.tsx`: Updated to integrate doughnut chart
- `app/(dashboard)/page.tsx`: Refactored dashboard layout to include both chart components
- `components/navbar.tsx`: Added light/dark mode toggle button
- `lib/chartColors.ts`: Shared color palette for consistent chart theming
- `docs/charts.md`: New charts & visualizations spec added
- `package.json` / `package-lock.json`: Added chart.js and react-chartjs-2 dependencies
- `CLAUDE.md`: Registered charts.md in the documentation index

## Test Plan
- [ ] Visit the dashboard and verify the Monthly Trend bar chart renders with correct data
- [ ] Verify the Spending by Category doughnut chart displays category breakdown
- [ ] Toggle between light and dark mode using the navbar button and confirm charts re-style accordingly
- [ ] Resize the browser window and confirm charts are responsive
- [ ] Run `npm run build` with no TypeScript or lint errors

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
