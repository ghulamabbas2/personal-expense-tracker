# Charts & Visualizations Specification

## Overview

All charts in this app use [react-chartjs-2](https://react-chartjs-2.js.org/) backed by [Chart.js](https://www.chartjs.org/). Charts are client-only components, loaded dynamically to avoid bloating the server bundle. Every chart must be fully responsive, dark-mode aware, and visually consistent with the HeroUI theme (violet primary, semantic color tokens, `md` radius).

---

## Installation

```bash
npm install react-chartjs-2 chart.js
```

No other charting libraries may be added. Do not install recharts, Victory, nivo, or similar alternatives.

---

## Tech Stack

| Concern | Tool |
|---|---|
| Chart rendering | `react-chartjs-2` + `chart.js` |
| Theme alignment | HeroUI CSS variables resolved at runtime |
| Responsiveness | CSS container sizing + `maintainAspectRatio: false` |
| Dark mode | `next-themes` `resolvedTheme` + runtime color switching |
| Bundle | `next/dynamic` with `ssr: false` |

---

## File & Component Conventions

### Location

All chart components live under `components/charts/`:

```
components/
  charts/
    SpendingDoughnutChart.tsx   # Spending by category (doughnut)
    MonthlyBarChart.tsx         # Monthly spending over time (bar)
    IncomeExpenseLineChart.tsx  # Income vs expense trends (line)
    BudgetProgressChart.tsx     # Budget utilization (horizontal bar)
    index.ts                    # Re-exports
```

### Required Directives

Every chart file **must** start with `"use client"` — Chart.js requires browser APIs (`canvas`, `ResizeObserver`).

```tsx
"use client"

import { Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)
```

Only register the Chart.js modules actually used by that component. Do not call `ChartJS.register(...)` with everything — this inflates the client bundle.

### Chart.js Module Registry

Register only what each chart type needs:

| Chart type | Modules to register |
|---|---|
| Doughnut / Pie | `ArcElement`, `Tooltip`, `Legend` |
| Bar | `BarElement`, `CategoryScale`, `LinearScale`, `Tooltip`, `Legend` |
| Line | `LineElement`, `PointElement`, `CategoryScale`, `LinearScale`, `Tooltip`, `Legend`, `Filler` |
| Horizontal Bar | `BarElement`, `CategoryScale`, `LinearScale`, `Tooltip`, `Legend` |

---

## Dynamic Import (Required)

Chart components must **never** be imported statically in Server Components or page files. Always use `next/dynamic` with `ssr: false`:

```tsx
// app/page.tsx or any Server Component
import dynamic from 'next/dynamic'
import { Spinner } from '@heroui/react'

const SpendingDoughnutChart = dynamic(
  () => import('@/components/charts/SpendingDoughnutChart'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" color="primary" />
      </div>
    ),
  }
)
```

Preload on hover for dashboard charts that are visible on page load:

```tsx
function DashboardChartCard() {
  const preload = () => {
    void import('@/components/charts/SpendingDoughnutChart')
  }
  return (
    <Card onMouseEnter={preload}>
      <CardBody>
        <SpendingDoughnutChart data={data} />
      </CardBody>
    </Card>
  )
}
```

---

## Responsive Sizing

Charts do **not** size themselves. The parent container controls all dimensions.

### Rules

1. Set `maintainAspectRatio: false` in every chart's `options`.
2. Wrap every `<Chart />` element in a `div` with an explicit height (Tailwind class or inline style).
3. Never set a fixed pixel width on the chart wrapper — use `w-full`.

```tsx
// Correct
<div className="w-full h-64">
  <Doughnut data={chartData} options={options} />
</div>

// Wrong — chart ignores container, does not resize
<Doughnut data={chartData} />
```

### Responsive Height Reference

| Context | Wrapper class |
|---|---|
| Dashboard summary card | `h-56` |
| Full-width section chart | `h-72 sm:h-96` |
| Compact sidebar widget | `h-40` |
| Settings / budget page | `h-48` |

---

## Theme Integration

### Color Palette

Use the HeroUI semantic color palette. Resolve colors at component render time from the document's computed CSS variables so dark mode switches work automatically.

Define a shared utility:

```ts
// lib/chartColors.ts
export function getChartColors(theme: 'light' | 'dark') {
  const isDark = theme === 'dark'

  return {
    // Primary palette (violet — matches HeroUI primary)
    primary:        isDark ? '#7c3aed' : '#6d28d9',
    primaryLight:   isDark ? '#a78bfa' : '#8b5cf6',

    // Semantic colors matching HeroUI tokens
    success:        isDark ? '#17c964' : '#12a150',
    danger:         isDark ? '#f31260' : '#c20a4b',
    warning:        isDark ? '#f5a524' : '#d97706',
    secondary:      isDark ? '#9353d3' : '#7828c8',

    // Category colors (consistent across all charts)
    categories: {
      Food:          '#f97316',   // orange
      Transport:     '#3b82f6',   // blue
      Housing:       '#8b5cf6',   // violet (primary)
      Entertainment: '#ec4899',   // pink
      Health:        '#22c55e',   // green
      Shopping:      '#f59e0b',   // amber
      Other:         '#6b7280',   // gray
    } as Record<string, string>,

    // Grid & axis lines
    gridLine:       isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    tickLabel:      isDark ? 'rgba(255,255,255,0.6)'  : 'rgba(0,0,0,0.5)',

    // Tooltip
    tooltipBg:      isDark ? '#18181b' : '#ffffff',
    tooltipBorder:  isDark ? '#3f3f46' : '#e4e4e7',
    tooltipText:    isDark ? '#fafafa' : '#18181b',
  }
}
```

### Applying Theme in a Component

```tsx
"use client"

import { useTheme } from 'next-themes'
import { useMemo } from 'react'
import { getChartColors } from '@/lib/chartColors'

export function SpendingDoughnutChart({ data }: Props) {
  const { resolvedTheme } = useTheme()
  const colors = useMemo(
    () => getChartColors((resolvedTheme as 'light' | 'dark') ?? 'light'),
    [resolvedTheme]
  )

  const chartData = useMemo(() => ({
    labels: data.map(d => d.category),
    datasets: [{
      data: data.map(d => d.amount),
      backgroundColor: data.map(d => colors.categories[d.category] ?? colors.primary),
      borderWidth: 0,
      hoverOffset: 6,
    }],
  }), [data, colors])

  // ...
}
```

---

## Global Chart Defaults

Set app-wide Chart.js defaults once in a shared module. Import this file in `app/layout.tsx` or the root client component.

```ts
// lib/chartDefaults.ts
import {
  Chart as ChartJS,
  defaults,
} from 'chart.js'

export function applyChartDefaults() {
  defaults.font.family = 'inherit'   // inherit from HeroUI's system font
  defaults.font.size   = 12
  defaults.responsive  = true
  defaults.maintainAspectRatio = false
  defaults.animation   = { duration: 400, easing: 'easeInOutQuart' }
  defaults.plugins.legend.labels.usePointStyle = true
  defaults.plugins.legend.labels.padding = 16
}
```

---

## Chart-by-Chart Specification

### 1. Spending by Category — Doughnut Chart

**Where**: Dashboard page summary, `/` — inside a `Card`

**Data shape**:
```ts
type CategorySpend = { category: string; amount: number }
```

**Options**:
```ts
const options: ChartOptions<'doughnut'> = {
  maintainAspectRatio: false,
  cutout: '70%',
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        color: colors.tickLabel,
        padding: 16,
        usePointStyle: true,
        pointStyleWidth: 8,
      },
    },
    tooltip: {
      backgroundColor: colors.tooltipBg,
      borderColor: colors.tooltipBorder,
      borderWidth: 1,
      titleColor: colors.tooltipText,
      bodyColor: colors.tooltipText,
      callbacks: {
        label: (ctx) => ` ${ctx.label}: $${ctx.parsed.toLocaleString()}`,
      },
    },
  },
}
```

**Center label plugin**: Use a Chart.js inline plugin to render the total amount in the doughnut hole.

```ts
const centerTextPlugin = {
  id: 'centerText',
  beforeDraw(chart: ChartJS) {
    const { ctx, chartArea: { top, right, bottom, left } } = chart
    const centerX = (left + right) / 2
    const centerY = (top + bottom) / 2
    const total = chart.data.datasets[0].data.reduce(
      (a: number, b) => a + (b as number), 0
    )
    ctx.save()
    ctx.font = 'bold 20px inherit'
    ctx.fillStyle = colors.tooltipText
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`$${total.toLocaleString()}`, centerX, centerY - 8)
    ctx.font = '12px inherit'
    ctx.fillStyle = colors.tickLabel
    ctx.fillText('Total', centerX, centerY + 14)
    ctx.restore()
  },
}
```

---

### 2. Monthly Spending — Bar Chart

**Where**: Dashboard page, `/` — full-width card below summary cards

**Data shape**:
```ts
type MonthlySpend = { month: string; income: number; expenses: number }
```

**Options**:
```ts
const options: ChartOptions<'bar'> = {
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: {
      position: 'top',
      align: 'end',
      labels: { color: colors.tickLabel, usePointStyle: true },
    },
    tooltip: {
      backgroundColor: colors.tooltipBg,
      borderColor: colors.tooltipBorder,
      borderWidth: 1,
      titleColor: colors.tooltipText,
      bodyColor: colors.tooltipText,
      callbacks: {
        label: (ctx) => ` ${ctx.dataset.label}: $${ctx.parsed.y.toLocaleString()}`,
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: colors.tickLabel },
      border: { display: false },
    },
    y: {
      grid: { color: colors.gridLine },
      ticks: {
        color: colors.tickLabel,
        callback: (val) => `$${val}`,
      },
      border: { display: false },
    },
  },
}
```

**Datasets**:
```ts
datasets: [
  {
    label: 'Income',
    data: data.map(d => d.income),
    backgroundColor: colors.success,
    borderRadius: 6,
    borderSkipped: false,
  },
  {
    label: 'Expenses',
    data: data.map(d => d.expenses),
    backgroundColor: colors.danger,
    borderRadius: 6,
    borderSkipped: false,
  },
]
```

---

### 3. Income vs Expense Trend — Line Chart

**Where**: Reports/analytics page

**Data shape**:
```ts
type TrendPoint = { date: string; income: number; expenses: number }
```

**Options**:
```ts
const options: ChartOptions<'line'> = {
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: {
      position: 'top',
      align: 'end',
      labels: { color: colors.tickLabel, usePointStyle: true },
    },
    tooltip: {
      backgroundColor: colors.tooltipBg,
      borderColor: colors.tooltipBorder,
      borderWidth: 1,
      titleColor: colors.tooltipText,
      bodyColor: colors.tooltipText,
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: colors.tickLabel, maxTicksLimit: 8 },
      border: { display: false },
    },
    y: {
      grid: { color: colors.gridLine },
      ticks: { color: colors.tickLabel, callback: (val) => `$${val}` },
      border: { display: false },
    },
  },
}
```

**Datasets**:
```ts
datasets: [
  {
    label: 'Income',
    data: data.map(d => d.income),
    borderColor: colors.success,
    backgroundColor: `${colors.success}20`,  // 12% opacity fill
    fill: true,
    tension: 0.4,
    pointRadius: 3,
    pointHoverRadius: 6,
  },
  {
    label: 'Expenses',
    data: data.map(d => d.expenses),
    borderColor: colors.danger,
    backgroundColor: `${colors.danger}20`,
    fill: true,
    tension: 0.4,
    pointRadius: 3,
    pointHoverRadius: 6,
  },
]
```

---

### 4. Budget Utilization — Horizontal Bar Chart

**Where**: Budget settings page, `/settings/budget` — one chart per category or a combined view

**Data shape**:
```ts
type BudgetStatus = { category: string; spent: number; budget: number }
```

**Options**:
```ts
const options: ChartOptions<'bar'> = {
  maintainAspectRatio: false,
  indexAxis: 'y',   // horizontal bars
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: colors.tooltipBg,
      borderColor: colors.tooltipBorder,
      borderWidth: 1,
      titleColor: colors.tooltipText,
      bodyColor: colors.tooltipText,
      callbacks: {
        label: (ctx) => {
          const item = data[ctx.dataIndex]
          const pct = Math.round((item.spent / item.budget) * 100)
          return ` $${item.spent.toLocaleString()} of $${item.budget.toLocaleString()} (${pct}%)`
        },
      },
    },
  },
  scales: {
    x: {
      grid: { color: colors.gridLine },
      ticks: { color: colors.tickLabel, callback: (val) => `$${val}` },
      border: { display: false },
      max: Math.max(...data.map(d => d.budget)),
    },
    y: {
      grid: { display: false },
      ticks: { color: colors.tickLabel },
      border: { display: false },
    },
  },
}
```

Bar colors should use `success` when `spent < budget * 0.8`, `warning` when `spent < budget`, and `danger` when `spent >= budget`.

```ts
backgroundColor: data.map(d =>
  d.spent >= d.budget         ? colors.danger :
  d.spent >= d.budget * 0.8   ? colors.warning :
                                colors.success
)
```

---

## Card Wrapper Pattern

All charts are rendered inside HeroUI `Card` components. Follow this structure consistently:

```tsx
<Card>
  <CardHeader className="flex justify-between items-center">
    <span className="text-sm font-medium text-default-600">Spending by Category</span>
    <Chip size="sm" variant="flat" color="primary">This Month</Chip>
  </CardHeader>
  <CardBody>
    <div className="w-full h-64">
      <SpendingDoughnutChart data={categoryData} />
    </div>
  </CardBody>
</Card>
```

---

## Loading & Empty States

### Loading

Use the HeroUI `Spinner` while the dynamic import resolves (provided via the `loading` prop on `next/dynamic`):

```tsx
loading: () => (
  <div className="flex items-center justify-center h-64">
    <Spinner size="lg" color="primary" />
  </div>
)
```

### Empty State

When the data array is empty or `null`, render a HeroUI empty state instead of a blank canvas:

```tsx
if (!data || data.length === 0) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-2">
      <p className="text-default-400 text-sm">No data available</p>
      <p className="text-default-300 text-xs">Add expenses to see your chart</p>
    </div>
  )
}
```

---

## Accessibility

Charts are visual summaries. Always provide a text-based alternative for screen readers.

### Rules

1. Every `<Chart />` element must have an `aria-label` describing the chart's purpose.
2. Pair each chart with a visible data table or list that presents the same information (e.g., the `Listbox` pattern in the dashboard spec).
3. Use `role="img"` on the chart wrapper `div`.

```tsx
<div className="w-full h-64" role="img" aria-label="Spending by category doughnut chart">
  <Doughnut data={chartData} options={options} />
</div>
```

4. Never use color as the only means of conveying information — tooltips and labels must include numeric values.

---

## Dark Mode

Charts **must** re-render with updated colors when the theme changes. Use `useTheme` from `next-themes` and include `resolvedTheme` as a `useMemo` dependency for all derived chart data and options.

```tsx
const { resolvedTheme } = useTheme()

const colors = useMemo(
  () => getChartColors((resolvedTheme as 'light' | 'dark') ?? 'light'),
  [resolvedTheme]
)

const options = useMemo(() => buildOptions(colors), [colors])
const chartData = useMemo(() => buildData(data, colors), [data, colors])
```

Do **not** use `useEffect` to update chart colors. Recomputing `options` and `data` via `useMemo` is sufficient — react-chartjs-2 will re-render the chart when props change.

---

## Performance Rules

1. **Dynamic import is mandatory** — Chart.js is ~200 kB minified. Never statically import it.
2. **Memoize chart data and options** — Wrap `datasets` and `options` objects in `useMemo` to prevent unnecessary redraws on unrelated parent re-renders.
3. **Register only needed modules** — Call `ChartJS.register(...)` with only the elements required by that chart type.
4. **Avoid inline object literals** in JSX chart props — they create new references every render and trigger full redraws.
5. **Use `id` prop on `<Chart />`** — Provide a stable `id` string so Chart.js can reuse the canvas element across re-renders instead of destroying and recreating it.

```tsx
<Doughnut id="spending-doughnut" data={chartData} options={options} />
```

---

## Complete Component Example

```tsx
"use client"

import { Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  type ChartOptions,
} from 'chart.js'
import { useMemo } from 'react'
import { useTheme } from 'next-themes'
import { getChartColors } from '@/lib/chartColors'

ChartJS.register(ArcElement, Tooltip, Legend)

type CategorySpend = { category: string; amount: number }

interface Props {
  data: CategorySpend[]
}

export function SpendingDoughnutChart({ data }: Props) {
  const { resolvedTheme } = useTheme()
  const colors = useMemo(
    () => getChartColors((resolvedTheme as 'light' | 'dark') ?? 'light'),
    [resolvedTheme]
  )

  const chartData = useMemo(() => ({
    labels: data.map(d => d.category),
    datasets: [{
      data: data.map(d => d.amount),
      backgroundColor: data.map(d => colors.categories[d.category] ?? colors.primary),
      borderWidth: 0,
      hoverOffset: 6,
    }],
  }), [data, colors])

  const options = useMemo<ChartOptions<'doughnut'>>(() => ({
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: colors.tickLabel,
          padding: 16,
          usePointStyle: true,
          pointStyleWidth: 8,
        },
      },
      tooltip: {
        backgroundColor: colors.tooltipBg,
        borderColor: colors.tooltipBorder,
        borderWidth: 1,
        titleColor: colors.tooltipText,
        bodyColor: colors.tooltipText,
        callbacks: {
          label: (ctx) => ` ${ctx.label}: $${ctx.parsed.toLocaleString()}`,
        },
      },
    },
  }), [colors])

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2">
        <p className="text-default-400 text-sm">No spending data yet</p>
        <p className="text-default-300 text-xs">Add expenses to see your breakdown</p>
      </div>
    )
  }

  return (
    <div className="w-full h-64" role="img" aria-label="Spending by category doughnut chart">
      <Doughnut id="spending-doughnut" data={chartData} options={options} />
    </div>
  )
}
```

---

## Summary Checklist

Before shipping any chart component, verify:

- [ ] File starts with `"use client"`
- [ ] Only required Chart.js modules are registered
- [ ] Imported via `next/dynamic` with `ssr: false` at the usage site
- [ ] `maintainAspectRatio: false` set in options
- [ ] Wrapped in a container `div` with an explicit Tailwind height class
- [ ] `chartData` and `options` are wrapped in `useMemo`
- [ ] Colors derived from `getChartColors(resolvedTheme)` via `useMemo`
- [ ] Empty state renders when data is empty
- [ ] `aria-label` and `role="img"` present on the wrapper
- [ ] `id` prop provided to the chart element
