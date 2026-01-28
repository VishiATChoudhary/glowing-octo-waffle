"use client";

import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";

type Hub = {
  id: string;
  hub: string;
  location: string;
  flag: string;
  averageScore: number;
  papersPublished: number;
};

const fullYearData: Hub[] = [
  { id: "4", hub: "Stanford", location: "USA", averageScore: 4.2, papersPublished: 467 },
  { id: "2", hub: "MIT", location: "USA", averageScore: 4.1, papersPublished: 528 },
  { id: "1", hub: "TU Delft", location: "Netherlands", averageScore: 3.9, papersPublished: 342 },
  { id: "9", hub: "Caltech", location: "USA", averageScore: 3.8, papersPublished: 245 },
  { id: "8", hub: "Oxford", location: "UK", averageScore: 3.7, papersPublished: 356 },
  { id: "3", hub: "ETH Zurich", location: "Switzerland", averageScore: 3.6, papersPublished: 298 },
  { id: "7", hub: "Tsinghua", location: "China", averageScore: 3.5, papersPublished: 412 },
  { id: "5", hub: "Cambridge", location: "UK", averageScore: 3.4, papersPublished: 389 },
  { id: "10", hub: "Imperial", location: "UK", averageScore: 3.2, papersPublished: 318 },
  { id: "6", hub: "NUS", location: "Singapore", averageScore: 3.1, papersPublished: 276 },
];

const columns: ColumnDef<Hub>[] = [
  {
    header: "Hub",
    accessorKey: "hub",
    cell: ({ row }) => <div className="font-medium">{row.getValue("hub")}</div>,
  },
  {
    header: "Location",
    accessorKey: "location",
  },
  {
    header: "Average Score",
    accessorKey: "averageScore",
    cell: ({ row }) => {
      const score = parseFloat(row.getValue("averageScore"));
      return <div>{score.toFixed(1)}</div>;
    },
  },
  {
    header: () => <div className="text-right">Papers Published</div>,
    accessorKey: "papersPublished",
    cell: ({ row }) => {
      const papers = parseInt(row.getValue("papersPublished"));
      return <div className="text-right">{papers.toLocaleString()}</div>;
    },
  },
];

const PERIODS = {
  '4w': {
    key: '4w',
    label: '4 weeks',
    dateRange: 'Last 4 weeks',
  },
  '3m': {
    key: '3m',
    label: '3 months',
    dateRange: 'Oct - Dec 2024',
  },
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

export default function EmergingHubs() {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>('12m');

  // Filter data based on selected period (for now, just slice the data)
  const getFilteredData = () => {
    switch (selectedPeriod) {
      case '4w':
        return fullYearData.slice(0, 3);
      case '3m':
        return fullYearData.slice(0, 5);
      case '6m':
        return fullYearData.slice(0, 7);
      case '12m':
        return fullYearData;
      default:
        return fullYearData;
    }
  };

  const filteredData = getFilteredData();
  const currentPeriod = PERIODS[selectedPeriod];

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="flex-1 flex flex-col">
      <div className="relative overflow-hidden p-6 border-b border-border bg-background">
        {/* Static Gradient Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 blur-3xl">
            <div
              className="absolute w-[500px] h-[500px] rounded-full opacity-50"
              style={{
                background: '#FDE047',
                top: '-30%',
                left: '5%',
              }}
            />
            <div
              className="absolute w-[600px] h-[600px] rounded-full opacity-50"
              style={{
                background: '#FBBF24',
                top: '-40%',
                left: '35%',
              }}
            />
            <div
              className="absolute w-[700px] h-[700px] rounded-full opacity-60"
              style={{
                background: '#F59E0B',
                top: '-50%',
                right: '-20%',
              }}
            />
          </div>
        </div>
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Top Emerging Hubs</h1>
            <p className="text-sm text-muted-foreground mt-1">{currentPeriod.dateRange}</p>
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
        </div>
      </div>

      <div className="flex-1 p-8">
        <div className="bg-background rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>
      </div>
    </div>
  );
}
