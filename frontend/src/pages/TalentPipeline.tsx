import React from 'react';
import TalentPipelineChart from '../components/TalentPipelineChart';

const TalentPipeline = () => {
  return (
    <div className="flex-1 p-8">
      <h1 className="text-2xl font-bold mb-6">Talent Pipeline</h1>
      <TalentPipelineChart />
    </div>
  );
};

export default TalentPipeline;
