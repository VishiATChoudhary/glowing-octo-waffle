'use client';

import * as React from 'react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import * as RechartsPrimitive from 'recharts';
import { Badge } from '@/components/ui/badge-2';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { TrendingUp } from 'lucide-react';
import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts';

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = { light: '', dark: '.dark' } as const;

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode;
    icon?: React.ComponentType;
  } & ({ color?: string; theme?: never } | { color?: never; theme: Record<keyof typeof THEMES, string> });
};

type ChartContextProps = {
  config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);

  if (!context) {
    throw new Error('useChart must be used within a <ChartContainer />');
  }

  return context;
}

function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<'div'> & {
  config: ChartConfig;
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>['children'];
}) {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, '')}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        className={cn(
          "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border flex aspect-video justify-center text-xs [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-hidden",
          className,
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(([, config]) => config.theme || config.color);

  if (!colorConfig.length) {
    return null;
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color = itemConfig.theme?.[theme as keyof typeof itemConfig.theme] || itemConfig.color;
    return color ? `  --color-${key}: ${color};` : null;
  })
  .join('\n')}
}
`,
          )
          .join('\n'),
      }}
    />
  );
};

const ChartTooltip = RechartsPrimitive.Tooltip;

function ChartTooltipContent({
  active,
  payload,
  className,
  indicator = 'dot',
  hideLabel = false,
  hideIndicator = false,
  label,
  labelFormatter,
  labelClassName,
  formatter,
  color,
  nameKey,
  labelKey,
}: React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
  React.ComponentProps<'div'> & {
    hideLabel?: boolean;
    hideIndicator?: boolean;
    indicator?: 'line' | 'dot' | 'dashed';
    nameKey?: string;
    labelKey?: string;
  }) {
  const { config } = useChart();

  const tooltipLabel = React.useMemo(() => {
    if (hideLabel || !payload?.length) {
      return null;
    }

    const [item] = payload;
    const key = `${labelKey || item?.dataKey || item?.name || 'value'}`;
    const itemConfig = getPayloadConfigFromPayload(config, item, key);
    const value =
      !labelKey && typeof label === 'string' ? config[label as keyof typeof config]?.label || label : itemConfig?.label;

    if (labelFormatter) {
      return <div className={cn('font-medium', labelClassName)}>{labelFormatter(value, payload)}</div>;
    }

    if (!value) {
      return null;
    }

    return <div className={cn('font-medium', labelClassName)}>{value}</div>;
  }, [label, labelFormatter, payload, hideLabel, labelClassName, config, labelKey]);

  if (!active || !payload?.length) {
    return null;
  }

  const nestLabel = payload.length === 1 && indicator !== 'dot';

  return (
    <div
      className={cn(
        'border-border/50 bg-background grid min-w-[8rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl',
        className,
      )}
    >
      {!nestLabel ? tooltipLabel : null}
      <div className="grid gap-1.5">
        {payload.map((item, index) => {
          const key = `${nameKey || item.name || item.dataKey || 'value'}`;
          const itemConfig = getPayloadConfigFromPayload(config, item, key);
          const indicatorColor = color || item.payload.fill || item.color;

          return (
            <div
              key={item.dataKey}
              className={cn(
                '[&>svg]:text-muted-foreground flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5',
                indicator === 'dot' && 'items-center',
              )}
            >
              {formatter && item?.value !== undefined && item.name ? (
                formatter(item.value, item.name, item, index, item.payload)
              ) : (
                <>
                  {itemConfig?.icon ? (
                    <itemConfig.icon />
                  ) : (
                    !hideIndicator && (
                      <div
                        className={cn('shrink-0 rounded-[2px] border-[--color-border] bg-[--color-bg]', {
                          'h-2.5 w-2.5': indicator === 'dot',
                          'w-1': indicator === 'line',
                          'w-0 border-[1.5px] border-dashed bg-transparent': indicator === 'dashed',
                          'my-0.5': nestLabel && indicator === 'dashed',
                        })}
                        style={ 
                          {
                            '--color-bg': indicatorColor,
                            '--color-border': indicatorColor,
                          } as React.CSSProperties
                        }
                      />
                    )
                  )}
                  <div
                    className={cn('flex flex-1 justify-between leading-none', nestLabel ? 'items-end' : 'items-center')}
                  >
                    <div className="grid gap-1.5">
                      {nestLabel ? tooltipLabel : null}
                      <span className="text-muted-foreground">{itemConfig?.label || item.name}</span>
                    </div>
                    {item.value && (
                      <span className="text-foreground font-mono font-medium tabular-nums">
                        {item.value.toLocaleString()}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ChartLegend = RechartsPrimitive.Legend;

function ChartLegendContent({
  className,
  hideIcon = false,
  payload,
  verticalAlign = 'bottom',
  nameKey,
}: React.ComponentProps<'div'> &
  Pick<RechartsPrimitive.LegendProps, 'payload' | 'verticalAlign'> & {
    hideIcon?: boolean;
    nameKey?: string;
  }) {
  const { config } = useChart();

  if (!payload?.length) {
    return null;
  }

  return (
    <div className={cn('flex items-center justify-center gap-4', verticalAlign === 'top' ? 'pb-3' : 'pt-3', className)}>
      {payload.map((item) => {
        const key = `${nameKey || item.dataKey || 'value'}`;
        const itemConfig = getPayloadConfigFromPayload(config, item, key);

        return (
          <div
            key={item.value}
            className={cn('[&>svg]:text-muted-foreground flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3')}
          >
            {itemConfig?.icon && !hideIcon ? (
              <itemConfig.icon />
            ) : (
              <div
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{
                  backgroundColor: item.color,
                }}
              />
            )}
            {itemConfig?.label}
          </div>
        );
      })}
    </div>
  );
}

// Helper to extract item config from a payload.
function getPayloadConfigFromPayload(config: ChartConfig, payload: unknown, key: string) {
  if (typeof payload !== 'object' || payload === null) {
    return undefined;
  }

  const payloadPayload = 
    'payload' in payload && typeof payload.payload === 'object' && payload.payload !== null
      ? payload.payload
      : undefined;

  let configLabelKey: string = key;

  if (key in payload && typeof payload[key as keyof typeof payload] === 'string') {
    configLabelKey = payload[key as keyof typeof payload] as string;
  } else if (
    payloadPayload &&
    key in payloadPayload &&
    typeof payloadPayload[key as keyof typeof payloadPayload] === 'string'
  ) {
    configLabelKey = payloadPayload[key as keyof typeof payloadPayload] as string;
  }

  return configLabelKey in config ? config[configLabelKey] : config[key as keyof typeof config];
}

// Cashflow data for 12 months
const cashflowData = [
  { month: 'JAN', value: 2100 },
  { month: 'FEB', value: 2300 },
  { month: 'MAR', value: 1900 },
  { month: 'APR', value: 4800 },
  { month: 'MAY', value: 5200 },
  { month: 'JUN', value: 8900 },
  { month: 'JUL', value: 6200 },
  { month: 'AUG', value: 7100 },
  { month: 'SEP', value: 9400 },
  { month: 'OCT', value: 10200 },
  { month: 'NOV', value: 11100 },
  { month: 'DEC', value: 11800 },
];

// Use custom or Tailwind standard colors: https://tailwindcss.com/docs/colors
const chartConfig = {
  value: {
    label: 'Cashflow',
    color: 'var(--color-violet-500)',
  },
} satisfies ChartConfig;

// Custom Tooltip
interface TooltipProps {
  active?: boolean;
  payload?: Array<{ 
    dataKey: string;
    value: number;
    color: string;
  }>;
  label?: string;
}

const CustomTooltip = ({ active, payload }: TooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg bg-zinc-900 text-white p-3 shadow-lg">
        <div className="text-xs font-medium mb-1">Total:</div>
        <div className="text-sm font-semibold">${payload[0].value.toLocaleString()}</div>
      </div>
    );
  }
  return null;
};

// Period configuration
const PERIODS = {
  '6m': {
    key: '6m',
    label: '6 months',
    dateRange: 'Jul 01 - Dec 31, 2024',
  },
  '12m': {
    key: '12m',
    label: '12 months',
    dateRange: 'Jan 01 - Dec 31, 2024',
  },
  '2y': {
    key: '2y',
    label: '2 years',
    dateRange: 'Jan 01, 2023 - Dec 31, 2024',
  },
} as const;

type PeriodKey = keyof typeof PERIODS;

export default function LineChart2() {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>('12m');

  // Filter data based on selected period
  const getFilteredData = () => {
    switch (selectedPeriod) {
      case '6m':
        return cashflowData.slice(-6);
      case '12m':
        return cashflowData;
      case '2y':
        // Simulate 2 years data by duplicating and modifying the current year
        const previousYear = cashflowData.map((item) => ({
          month: `${item.month} '23`,
          value: Math.round(item.value * 0.85), // 15% lower for previous year
        }));
        const currentYear = cashflowData.map((item) => ({
          month: `${item.month} '24`,
          value: item.value,
        }));
        return [...previousYear, ...currentYear];
      default:
        return cashflowData;
    }
  };

  const filteredData = getFilteredData();

  // Get current period configuration
  const currentPeriod = PERIODS[selectedPeriod];

  // Calculate total and percentage based on filtered data
  const totalCash = filteredData.reduce((sum, item) => sum + item.value, 0);
  const lastValue = filteredData[filteredData.length - 1]?.value || 0;
  const previousValue = filteredData[filteredData.length - 2]?.value || 0;
  const percentageChange = previousValue > 0 ? ((lastValue - previousValue) / previousValue) * 100 : 0;

  return (
    <div className="w-full max-w-5xl min-h-screen flex items-center justify-center p-6 lg:p-8">
      <Card className="w-full lg:max-w-4xl ">
        <CardHeader className="border-0 min-h-auto pt-6 pb-4">
          <CardTitle className="text-lg font-semibold">Cashflow</CardTitle>
          <CardToolbar>
            <Select value={selectedPeriod} onValueChange={(value) => setSelectedPeriod(value as PeriodKey)}>
              <SelectTrigger>{currentPeriod.label}</SelectTrigger>
              <SelectContent align="end">
                {Object.values(PERIODS).map((period) => (
                  <SelectItem key={period.key} value={period.key}>
                    {period.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardToolbar>
        </CardHeader>

        <CardContent className="px-0">
          {/* Stats Section */}
          <div className="px-5 mb-8">
            <div className="text-xs font-medium text-muted-foreground tracking-wide mb-2">
              {currentPeriod.dateRange}
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="text-3xl font-bold">${totalCash.toLocaleString()}</div>
              <Badge variant="success" appearance="light">
                <TrendingUp className="size-3" />
                {Math.abs(percentageChange).toFixed(2)}%
              </Badge>
            </div>
          </div>

          {/* Chart */}
          <div className="relative">
            <ChartContainer
              config={chartConfig}
              className="h-[300px] w-full ps-1.5 pe-2.5 overflow-visible [&_.recharts-curve.recharts-tooltip-cursor]:stroke-initial"
            >
              <ComposedChart
                data={filteredData}
                margin={{
                  top: 25,
                  right: 25,
                  left: 0,
                  bottom: 25,
                }}
                style={{ overflow: 'visible' }}
              >
                {/* Gradient */}
                <defs>
                  <linearGradient id="cashflowGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartConfig.value.color} stopOpacity={0.15} />
                    <stop offset="100%" stopColor={chartConfig.value.color} stopOpacity={0} />
                  </linearGradient>
                  <filter id="dotShadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="2" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,0.5)" />
                  </filter>
                </defs>

                <CartesianGrid
                  strokeDasharray="4 12"
                  stroke="var(--input)"
                  strokeOpacity={1}
                  horizontal={true}
                  vertical={false}
                />

                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12 }}
                  tickMargin={12}
                  dy={10}
                />

                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => `${value / 1000}K`}
                  domain={[0, 'dataMax + 1000']}
                  tickCount={6}
                  tickMargin={12}
                />

                <ChartTooltip
                  content={<CustomTooltip />}
                  cursor={{
                    stroke: chartConfig.value.color,
                    strokeWidth: 1,
                    strokeDasharray: 'none',
                  }}
                />

                {/* Gradient area */}
                <Area
                  type="linear"
                  dataKey="value"
                  stroke="transparent"
                  fill="url(#cashflowGradient)"
                  strokeWidth={0}
                  dot={false}
                />

                {/* Main cashflow line */}
                <Line
                  type="linear"
                  dataKey="value"
                  stroke={chartConfig.value.color}
                  strokeWidth={3}
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    if (payload.month === 'JUN' || payload.month === 'NOV') {
                      return (
                        <circle
                          key={`dot-${cx}-${cy}`}
                          cx={cx}
                          cy={cy}
                          r={6}
                          fill={chartConfig.value.color}
                          stroke="white"
                          strokeWidth={2}
                          filter="url(#dotShadow)"
                        />
                      );
                    }
                    return <g key={`dot-${cx}-${cy}`} />; // Return empty group for other points
                  }}
                  activeDot={{
                    r: 6,
                    fill: chartConfig.value.color,
                    stroke: 'white',
                    strokeWidth: 2,
                    filter: 'url(#dotShadow)',
                  }}
                />
              </ComposedChart>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
