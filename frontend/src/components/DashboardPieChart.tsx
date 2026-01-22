"use client";

import { LabelList, Pie, PieChart, Cell } from "recharts";

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/pie-chart";

const chartData = [
  { category: "timing", score: 3.5, fill: "var(--color-timing)" },
  { category: "scalability", score: 4.2, fill: "var(--color-scalability)" },
  { category: "advantage", score: 3.8, fill: "var(--color-advantage)" },
  { category: "readiness", score: 4.5, fill: "var(--color-readiness)" },
  { category: "demand", score: 4.8, fill: "var(--color-demand)" },
];

// Sort the data by score in ascending order (smallest to largest)
const sortedChartData = [...chartData].sort((a, b) => a.score - b.score);

// Configure the size increase between each pie ring
const BASE_RADIUS = 50; // Starting radius for the smallest pie
const SIZE_INCREMENT = 10; // How much to increase radius for each subsequent pie

const chartConfig = {
  score: {
    label: "Score",
  },
  timing: {
    label: "Market Trends & Timing",
    color: "#FFD500",
  },
  scalability: {
    label: "Business Model & Scalability Potential",
    color: "#FFDC2E",
  },
  advantage: {
    label: "Competitive Advantage",
    color: "#FFE761",
  },
  readiness: {
    label: "Application Readiness",
    color: "#FFEA76",
  },
  demand: {
    label: "Market Demand & Problem Validation",
    color: "#FFF394",
  },
} satisfies ChartConfig;

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const config = chartConfig[data.category as keyof typeof chartConfig];

    return (
      <div className="bg-background border border-border/50 rounded-lg p-3 shadow-xl">
        <p className="text-sm font-medium mb-2">{config.label}</p>
        <div className="flex items-end gap-2">
          <span className="text-3xl font-semibold">{data.score}</span>
          <span className="text-sm text-muted-foreground pb-1">score</span>
        </div>
      </div>
    );
  }
  return null;
};

export default function DashboardPieChart() {
  return (
    <div className="flex flex-col w-full items-center">
      <h2 className="text-lg font-semibold text-center">Average Entrepreneurial Potential</h2>
      <div className="flex flex-col items-center gap-3">
        <ChartContainer
          config={chartConfig}
          className="[&_.recharts-text]:fill-background w-[550px] h-[550px]"
        >
          <PieChart>
            <ChartTooltip content={<CustomTooltip />} />
            {sortedChartData.map((entry, index) => (
              <Pie
                key={`pie-${index}`}
                data={[entry]}
                innerRadius={65}
                outerRadius={140 + index * 30}
                dataKey="score"
                cornerRadius={5}
                startAngle={
                  // Calculate the percentage of total score up to current index
                  (sortedChartData
                    .slice(0, index)
                    .reduce((sum, d) => sum + d.score, 0) /
                    sortedChartData.reduce((sum, d) => sum + d.score, 0)) *
                  360
                }
                endAngle={
                  // Calculate the percentage of total score up to and including current index
                  (sortedChartData
                    .slice(0, index + 1)
                    .reduce((sum, d) => sum + d.score, 0) /
                    sortedChartData.reduce((sum, d) => sum + d.score, 0)) *
                  360
                }
              >
                <Cell fill={entry.fill} />
                <LabelList
                  dataKey="score"
                  stroke="none"
                  fontSize={16}
                  fontWeight={500}
                  fill="currentColor"
                  formatter={(value: number) => value.toString()}
                />
              </Pie>
            ))}
          </PieChart>
        </ChartContainer>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm w-[550px]">
          {sortedChartData.map((item) => {
            const config = chartConfig[item.category as keyof typeof chartConfig];
            return (
              <div key={item.category} className="flex items-start gap-3">
                <div
                  className="w-5 h-5 rounded-full shrink-0 mt-0.5"
                  style={{ backgroundColor: config.color }}
                />
                <span className="text-foreground leading-tight">{config.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
