import React from 'react';
import LineChart2 from '../components/ui/LineChart2';

const TalentPipeline = () => {
  return (
    <div className="flex-1 p-8 flex">
      <div className="w-1/2">
        <h1 className="text-2xl font-bold mb-4">Talent Pipeline</h1>
        <LineChart2 />
      </div>
      <div className="w-1/2">
        {/* Right half of the page */}
      </div>
    </div>
  );
};

export default TalentPipeline;
