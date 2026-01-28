import React from 'react';
import TalentPipelineChart from '../components/TalentPipelineChart';

const TalentPipeline = () => {
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
        <div className="relative z-10">
          <h1 className="text-2xl font-bold">Talent Pipeline</h1>
        </div>
      </div>
      <div className="flex-1 p-8">
        <TalentPipelineChart />
      </div>
    </div>
  );
};

export default TalentPipeline;
