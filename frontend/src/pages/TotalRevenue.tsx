import React from 'react';
import DashboardPieChart from '../components/DashboardPieChart';
import RotatingEarth from '../components/ui/wireframe-dotted-globe';

const TotalRevenue = () => {
  return (
    <div className="w-full h-screen overflow-auto p-8">
      <h1 className="text-2xl font-bold mb-4">New Papers</h1>
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
  );
};

export default TotalRevenue;
