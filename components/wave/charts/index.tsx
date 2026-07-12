"use client"

import { cn } from "@/lib/utils"
import {
  Area,
  EvilAreaChart,
  Grid as AreaGrid,
  Legend as AreaLegend,
  Tooltip as AreaTooltip,
  XAxis as AreaXAxis,
  YAxis as AreaYAxis,
} from "@/components/evilcharts/charts/area-chart"
import {
  Bar,
  EvilBarChart,
  Grid as BarGrid,
  Legend as BarLegend,
  Tooltip as BarTooltip,
  XAxis as BarXAxis,
  YAxis as BarYAxis,
} from "@/components/evilcharts/charts/bar-chart"
import {
  EvilRadarChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  Tooltip as RadarTooltip,
} from "@/components/evilcharts/charts/radar-chart"
import {
  EvilPieChart,
  Pie,
  Tooltip as PieTooltip,
} from "@/components/evilcharts/charts/pie-chart"
import type { ChartConfig } from "@/components/evilcharts/ui/chart"

export interface WaveChartSeries {
  key: string
  label: string
  color?: string
  darkColor?: string
}

interface WaveChartBaseProps<TData extends object> {
  data: TData[]
  label: string
  className?: string
  emptyMessage?: string
}

interface WaveCartesianChartProps<TData extends object> extends WaveChartBaseProps<TData> {
  xKey: keyof TData & string
  series: readonly WaveChartSeries[]
  showLegend?: boolean
  allowDecimals?: boolean
}

const DEFAULT_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

function makeConfig(series: readonly WaveChartSeries[]): ChartConfig {
  return Object.fromEntries(series.map((item, index) => [
    item.key,
    {
      label: item.label,
      colors: {
        light: [item.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length]],
        dark: [item.darkColor ?? item.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length]],
      },
    },
  ]))
}

function AccessibleDataTable<TData extends object>({
  data,
  label,
  columns,
}: {
  data: TData[]
  label: string
  columns: Array<{ key: string; label: string }>
}) {
  return (
    <table className="sr-only">
      <caption>{label}</caption>
      <thead>
        <tr>{columns.map((column) => <th key={column.key} scope="col">{column.label}</th>)}</tr>
      </thead>
      <tbody>
        {data.map((row, index) => (
          <tr key={index}>
            {columns.map((column) => <td key={column.key}>{String((row as Record<string, unknown>)[column.key] ?? "")}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function EmptyChart({ message = "No data available" }: { message?: string }) {
  return <div className="grid h-full min-h-40 place-items-center rounded-md border border-dashed text-sm text-muted-foreground">{message}</div>
}

export function WaveAreaChart<TData extends object>({
  data,
  label,
  xKey,
  series,
  showLegend = series.length > 1,
  allowDecimals = false,
  className,
  emptyMessage,
}: WaveCartesianChartProps<TData>) {
  if (data.length === 0) return <EmptyChart message={emptyMessage} />
  const config = makeConfig(series)

  return (
    <figure aria-label={label} className="min-w-0">
      <EvilAreaChart
        data={data as Record<string, unknown>[]}
        config={config}
        curveType="monotone"
        animationType="none"
        className={cn("h-[280px] aspect-auto", className)}
        chartProps={{ margin: { top: 8, right: 8, bottom: 0, left: 0 } }}
      >
        <AreaGrid stroke="var(--border)" strokeOpacity={0.7} />
        <AreaXAxis dataKey={xKey} />
        <AreaYAxis allowDecimals={allowDecimals} />
        <AreaTooltip roundness="md" />
        {showLegend ? <AreaLegend align="left" verticalAlign="top" variant="rounded-square" /> : null}
        {series.map((item) => (
          <Area key={item.key} dataKey={item.key} variant="gradient" strokeVariant="solid" animationType="none" />
        ))}
      </EvilAreaChart>
      <AccessibleDataTable data={data} label={label} columns={[
        { key: xKey, label: xKey },
        ...series.map((item) => ({ key: item.key, label: item.label })),
      ]} />
    </figure>
  )
}

export function WaveBarChart<TData extends object>({
  data,
  label,
  xKey,
  series,
  showLegend = series.length > 1,
  allowDecimals = false,
  className,
  emptyMessage,
}: WaveCartesianChartProps<TData>) {
  if (data.length === 0) return <EmptyChart message={emptyMessage} />
  const config = makeConfig(series)

  return (
    <figure aria-label={label} className="min-w-0">
      <EvilBarChart
        data={data as Record<string, unknown>[]}
        config={config}
        animationType="none"
        barRadius={4}
        className={cn("h-[280px] aspect-auto", className)}
        chartProps={{ margin: { top: 8, right: 8, bottom: 0, left: 0 } }}
      >
        <BarGrid vertical={false} stroke="var(--border)" strokeOpacity={0.7} />
        <BarXAxis dataKey={xKey} />
        <BarYAxis allowDecimals={allowDecimals} />
        <BarTooltip roundness="md" />
        {showLegend ? <BarLegend align="left" verticalAlign="top" variant="rounded-square" /> : null}
        {series.map((item) => <Bar key={item.key} dataKey={item.key} variant="default" animationType="none" />)}
      </EvilBarChart>
      <AccessibleDataTable data={data} label={label} columns={[
        { key: xKey, label: xKey },
        ...series.map((item) => ({ key: item.key, label: item.label })),
      ]} />
    </figure>
  )
}

interface WaveRadarChartProps<TData extends object> extends WaveChartBaseProps<TData> {
  categoryKey: keyof TData & string
  series: readonly WaveChartSeries[]
  maxValue?: number
}

export function WaveRadarChart<TData extends object>({
  data,
  label,
  categoryKey,
  series,
  maxValue = 100,
  className,
  emptyMessage,
}: WaveRadarChartProps<TData>) {
  if (data.length === 0) return <EmptyChart message={emptyMessage} />
  const config = makeConfig(series)

  return (
    <figure aria-label={label} className="min-w-0">
      <EvilRadarChart
        data={data as Record<string, unknown>[]}
        config={config}
        className={cn("h-[240px] aspect-auto", className)}
        chartProps={{ cx: "50%", cy: "50%", outerRadius: "68%", accessibilityLayer: true }}
      >
        <PolarGrid stroke="var(--border)" strokeDasharray="3 4" />
        <PolarAngleAxis dataKey={categoryKey} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
        <PolarRadiusAxis domain={[0, maxValue]} tick={false} axisLine={false} />
        <RadarTooltip roundness="md" />
        {series.map((item) => <Radar key={item.key} dataKey={item.key} variant="filled" fillOpacity={0.25} isGlowing={false} />)}
      </EvilRadarChart>
      <AccessibleDataTable data={data} label={label} columns={[
        { key: categoryKey, label: categoryKey },
        ...series.map((item) => ({ key: item.key, label: item.label })),
      ]} />
    </figure>
  )
}

interface WaveDonutChartProps<TData extends object> extends WaveChartBaseProps<TData> {
  nameKey: keyof TData & string
  valueKey: keyof TData & string
  colors?: readonly string[]
}

export function WaveDonutChart<TData extends object>({
  data,
  label,
  nameKey,
  valueKey,
  colors = DEFAULT_COLORS,
  className,
  emptyMessage,
}: WaveDonutChartProps<TData>) {
  if (data.length === 0) return <EmptyChart message={emptyMessage} />
  const config: ChartConfig = Object.fromEntries(data.map((item, index) => [
    String((item as Record<string, unknown>)[nameKey]),
    { label: String((item as Record<string, unknown>)[nameKey]), colors: { light: [colors[index % colors.length]], dark: [colors[index % colors.length]] } },
  ]))

  return (
    <figure aria-label={label} className="min-w-0">
      <EvilPieChart data={data as Record<string, unknown>[]} config={config} nameKey={nameKey} dataKey={valueKey} className={cn("h-[180px] aspect-auto", className)}>
        <Pie variant="gradient" innerRadius="48%" outerRadius="78%" cornerRadius={3} paddingAngle={2} />
        <PieTooltip roundness="md" />
      </EvilPieChart>
      <AccessibleDataTable data={data} label={label} columns={[
        { key: nameKey, label: nameKey },
        { key: valueKey, label: valueKey },
      ]} />
    </figure>
  )
}
