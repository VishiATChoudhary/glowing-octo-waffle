import React from 'react';
import DashboardPieChart from '../components/DashboardPieChart';
import RotatingEarth from '../components/ui/wireframe-dotted-globe';

const TotalRevenue = () => {
  return (
    <div className="w-full h-screen flex flex-col overflow-auto">
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
        <div className="relative z-10">
          <h1 className="text-2xl font-bold">New Papers</h1>
        </div>
      </div>
      <div className="flex-1 p-8">
        <div className="grid grid-cols-2 gap-12 items-start">
        {/* Left Half - Globe */}
        <div className="flex items-start justify-center pt-4">
          <RotatingEarth width={550} height={550} />
        </div>

        {/* Right Half - Pie Chart */}
        <div className="flex items-start justify-center">
          <DashboardPieChart />
        </div>
      </div>
      </div>
    </div>
  );
};

export default TotalRevenue;
