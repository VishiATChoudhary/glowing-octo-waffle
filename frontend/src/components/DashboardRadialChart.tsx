"use client";

import { RadialBar, RadialBarChart, Legend } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/pie-chart";

const chartData = [
  { category: "timing", researchers: 3.5, fill: "url(#pattern-timing)" },
  { category: "scalability", researchers: 4.2, fill: "url(#pattern-scalability)" },
  { category: "advantage", researchers: 3.8, fill: "url(#pattern-advantage)" },
  { category: "readiness", researchers: 4.5, fill: "url(#pattern-readiness)" },
  { category: "demand", researchers: 5, fill: "url(#pattern-demand)" },
];

const chartConfig = {
  researchers: { label: "Researchers" },
  timing: { label: "Market Trends & Timing", color: "#A7F3D0" }, // Pastel green (innermost)
  scalability: { label: "Business Model & Scalability Potential", color: "#FBCFE8" }, // Pastel pink
  advantage: { label: "Competitive Advantage", color: "#FDE68A" }, // Pastel amber/yellow
  readiness: { label: "Application Readiness", color: "#BFDBFE" }, // Pastel light blue
  demand: { label: "Market Demand & Problem Validation", color: "#93C5FD" }, // Pastel blue (outermost)
} satisfies ChartConfig;

export default function DashboardRadialChart() {
  return (
    <Card className="flex flex-col w-full">
      <CardHeader className="items-center pb-0">
        <CardTitle>Innovation Assessment</CardTitle>
        <CardDescription>Evaluation Criteria</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0 flex flex-row justify-center items-center gap-8">
        <ChartContainer
          config={chartConfig}
          className="w-[250px] h-[250px] rounded-full"
        >
          <RadialBarChart data={chartData} innerRadius={30} outerRadius={110}>
            <defs>
              {/* Grain filter */}
              <filter id="grainFilter">
                <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" result="noise" />
                <feColorMatrix in="noise" type="saturate" values="0" result="desaturatedNoise" />
                <feComponentTransfer in="desaturatedNoise" result="theNoise">
                  <feFuncA type="table" tableValues="0 0 0.15 0" />
                </feComponentTransfer>
              </filter>

              {/* Grainy color patterns for each category */}
              <pattern id="pattern-timing" patternUnits="userSpaceOnUse" width="100" height="100">
                <rect width="100" height="100" fill="#A7F3D0" />
                <rect width="100" height="100" filter="url(#grainFilter)" opacity="1" fill="black" />
              </pattern>

              <pattern id="pattern-scalability" patternUnits="userSpaceOnUse" width="100" height="100">
                <rect width="100" height="100" fill="#FBCFE8" />
                <rect width="100" height="100" filter="url(#grainFilter)" opacity="1" fill="black" />
              </pattern>

              <pattern id="pattern-advantage" patternUnits="userSpaceOnUse" width="100" height="100">
                <rect width="100" height="100" fill="#FDE68A" />
                <rect width="100" height="100" filter="url(#grainFilter)" opacity="1" fill="black" />
              </pattern>

              <pattern id="pattern-readiness" patternUnits="userSpaceOnUse" width="100" height="100">
                <rect width="100" height="100" fill="#BFDBFE" />
                <rect width="100" height="100" filter="url(#grainFilter)" opacity="1" fill="black" />
              </pattern>

              <pattern id="pattern-demand" patternUnits="userSpaceOnUse" width="100" height="100">
                <rect width="100" height="100" fill="#93C5FD" />
                <rect width="100" height="100" filter="url(#grainFilter)" opacity="1" fill="black" />
              </pattern>
            </defs>
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="category" />} />
            <RadialBar
              cornerRadius={10}
              dataKey="researchers"
              background
              className="drop-shadow-lg"
            />
          </RadialBarChart>
        </ChartContainer>
        <div className="flex flex-col gap-3 text-sm">
          {chartData.slice().reverse().map((item) => {
            const config = chartConfig[item.category as keyof typeof chartConfig];
            return (
              <div key={item.category} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full shrink-0 relative"
                  style={{ backgroundColor: config.color }}
                >
                  <div
                    className="absolute inset-0 rounded-full opacity-30"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                      mixBlendMode: 'multiply',
                    }}
                  />
                </div>
                <span className="text-foreground">{config.label}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
