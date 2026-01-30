"use client";

import React, { useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/area-chart";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";

// Full year data
const fullChartData = [
  { month: "January", saved: 35, contacted: 18, meeting: 8 },
  { month: "February", saved: 42, contacted: 24, meeting: 12 },
  { month: "March", saved: 48, contacted: 26, meeting: 14 },
  { month: "April", saved: 55, contacted: 30, meeting: 16 },
  { month: "May", saved: 50, contacted: 27, meeting: 13 },
  { month: "June", saved: 45, contacted: 24, meeting: 11 },
  { month: "July", saved: 52, contacted: 28, meeting: 15 },
  { month: "August", saved: 60, contacted: 33, meeting: 18 },
  { month: "September", saved: 58, contacted: 31, meeting: 17 },
  { month: "October", saved: 54, contacted: 29, meeting: 15 },
  { month: "November", saved: 62, contacted: 35, meeting: 19 },
  { month: "December", saved: 68, contacted: 38, meeting: 21 },
];

const chartConfig = {
  saved: {
    label: "Saved",
    color: "#FFD500",
  },
  contacted: {
    label: "Contacted",
    color: "#FFE761",
  },
  meeting: {
    label: "Meeting",
    color: "#FFF394",
  },
} satisfies ChartConfig;

// Period configuration
const PERIODS = {
  '6m': {
    key: '6m',
    label: '6 months',
    dateRange: 'Jul - Dec 2024',
  },
  '12m': {
    key: '12m',
    label: '12 months',
    dateRange: 'Jan - Dec 2024',
  },
} as const;

type PeriodKey = keyof typeof PERIODS;

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    // Reverse the payload to show in visual order (top to bottom)
    const reversedPayload = [...payload].reverse();

    return (
      <div className="bg-background border border-border/50 rounded-lg p-2.5 shadow-xl">
        <div className="font-medium text-xs mb-1.5">{label}</div>
        <div className="grid gap-1.5">
          {reversedPayload.map((item: any) => (
            <div key={item.dataKey} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <div
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-muted-foreground">{chartConfig[item.dataKey as keyof typeof chartConfig]?.label}</span>
              </div>
              <span className="font-mono font-medium tabular-nums">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function TalentPipelineChart() {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>('12m');

  // Filter data based on selected period
  const getFilteredData = () => {
    switch (selectedPeriod) {
      case '6m':
        return fullChartData.slice(-6);
      case '12m':
        return fullChartData;
      default:
        return fullChartData;
    }
  };

  const filteredData = getFilteredData();
  const currentPeriod = PERIODS[selectedPeriod];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle>Talent Pipeline Progress</CardTitle>
          <CardDescription>
            {currentPeriod.dateRange}
          </CardDescription>
        </div>
        <Select value={selectedPeriod} onValueChange={(value) => setSelectedPeriod(value as PeriodKey)}>
          <SelectTrigger className="w-[140px]">{currentPeriod.label}</SelectTrigger>
          <SelectContent align="end">
            {Object.values(PERIODS).map((period) => (
              <SelectItem key={period.key} value={period.key}>
                {period.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <AreaChart accessibilityLayer data={filteredData}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <defs>
              <HatchedBackgroundPattern config={chartConfig} />
            </defs>
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => value.slice(0, 3)}
            />
            <ChartTooltip cursor={false} content={<CustomTooltip />} />
            <Area
              dataKey="meeting"
              type="natural"
              fill={"url(#bar-background-pattern-meeting)"}
              fillOpacity={0.6}
              stroke="#FFF394"
              stackId="a"
              strokeWidth={2}
            />
            <Area
              dataKey="contacted"
              type="natural"
              fill={"url(#bar-background-pattern-contacted)"}
              fillOpacity={0.6}
              stroke="#FFE761"
              stackId="a"
              strokeWidth={2}
            />
            <Area
              dataKey="saved"
              type="natural"
              fill={"url(#bar-background-pattern-saved)"}
              fillOpacity={0.6}
              stroke="#FFD500"
              stackId="a"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

const HatchedBackgroundPattern = ({ config }: { config: ChartConfig }) => {
  const items = Object.fromEntries(
    Object.entries(config).map(([key, value]) => [key, value.color])
  );
  return (
    <>
      {Object.entries(items).map(([key, value]) => (
        <g key={key}>
          <linearGradient
            id={`bar-pattern-gradient-${key}`}
            x1="0"
            y1="0"
            x2="1"
            y2="0"
          >
            <stop offset="50%" stopColor={value} stopOpacity={0.4} />
            <stop offset="50%" stopColor={value} stopOpacity={1} />
          </linearGradient>
          <pattern
            id={`bar-background-pattern-${key}`}
            x="0"
            y="0"
            width="40"
            height="10"
            patternUnits="userSpaceOnUse"
            overflow="visible"
          >
            <rect
              width="40"
              height="10"
              fill={`url(#bar-pattern-gradient-${key})`}
            />
          </pattern>
        </g>
      ))}
    </>
  );
};
