import React from 'react';
import DashboardPieChart from '../components/DashboardPieChart';
import RotatingEarth from '../components/ui/wireframe-dotted-globe';

const TotalRevenue = () => {
  return (
    <div className="w-full h-screen overflow-auto p-8">
      <h1 className="text-2xl font-bold mb-8">New Papers</h1>
      <div className="grid grid-cols-2 gap-8 h-[calc(100vh-120px)]">
        {/* Left Half - Globe */}
        <div className="flex items-center justify-center">
          <RotatingEarth width={600} height={600} />
        </div>

        {/* Right Half - Pie Chart */}
        <div className="flex items-center justify-center pr-12">
          <DashboardPieChart />
        </div>
      </div>
    </div>
  );
};

export default TotalRevenue;
