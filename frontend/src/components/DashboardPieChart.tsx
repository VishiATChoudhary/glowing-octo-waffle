"use client";

import { LabelList, Pie, PieChart, Cell } from "recharts";

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/pie-chart";

const chartData = [
  { category: "timing", score: 3.5, fill: "var(--color-timing)" },
  { category: "scalability", score: 4.2, fill: "var(--color-scalability)" },
  { category: "advantage", score: 3.8, fill: "var(--color-advantage)" },
  { category: "readiness", score: 4.5, fill: "var(--color-readiness)" },
  { category: "demand", score: 5, fill: "var(--color-demand)" },
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

export default function DashboardPieChart() {
  return (
    <div className="flex flex-col w-full">
      <div className="items-center pb-4 text-center">
        <h2 className="text-2xl font-semibold">Average Entrepreneurial Potential</h2>
      </div>
      <div className="flex-1 flex flex-row justify-center items-center gap-6">
        <ChartContainer
          config={chartConfig}
          className="[&_.recharts-text]:fill-background w-[450px] h-[450px]"
        >
          <PieChart>
            <ChartTooltip
              content={<ChartTooltipContent nameKey="score" hideLabel />}
            />
            {sortedChartData.map((entry, index) => (
              <Pie
                key={`pie-${index}`}
                data={[entry]}
                innerRadius={50}
                outerRadius={85 + index * 22}
                dataKey="score"
                cornerRadius={4}
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
                  fontSize={14}
                  fontWeight={500}
                  fill="currentColor"
                  formatter={(value: number) => value.toString()}
                />
              </Pie>
            ))}
          </PieChart>
        </ChartContainer>
        <div className="flex flex-col gap-4 text-sm max-w-[320px]">
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
