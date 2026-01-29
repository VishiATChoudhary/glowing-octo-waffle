import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TopicNebula, { TopicNebulaData } from "@/components/TopicNebula";

// Mock data for Melta Air Batteries topic - based on 2025-2026 research
const mockTopicData: TopicNebulaData = {
  centralNode: {
    id: "central-1",
    text: "Melta Air Batteries",
    weight: 100,
    type: "core",
  },
  relatedNodes: [
    // Application examples (High Weight) - Current emerging uses
    {
      id: "app-1",
      text: "Electric Vehicle Range Extenders",
      weight: 92,
      type: "application",
    },
    {
      id: "app-2",
      text: "Grid Energy Storage",
      weight: 90,
      type: "application",
    },
    {
      id: "app-3",
      text: "eVTOL Aircraft",
      weight: 88,
      type: "application",
    },
    {
      id: "app-4",
      text: "Renewable Energy Storage",
      weight: 85,
      type: "application",
    },
    {
      id: "app-5",
      text: "Heavy-lift Drones",
      weight: 82,
      type: "application",
    },
    {
      id: "app-6",
      text: "Railway Signaling Systems",
      weight: 78,
      type: "application",
    },
    {
      id: "app-7",
      text: "Medical Devices",
      weight: 75,
      type: "application",
    },
    {
      id: "app-8",
      text: "Emergency Backup Power",
      weight: 72,
      type: "application",
    },
    // Technical terms (High Weight) - Current research focus 2025-2026
    {
      id: "tech-1",
      text: "Oxygen Reduction Reaction (ORR)",
      weight: 90,
      type: "technical",
    },
    {
      id: "tech-2",
      text: "Bifunctional Catalysts",
      weight: 88,
      type: "technical",
    },
    {
      id: "tech-3",
      text: "Zinc-Air Chemistry",
      weight: 86,
      type: "technical",
    },
    {
      id: "tech-4",
      text: "Air-Breathing Cathodes",
      weight: 84,
      type: "technical",
    },
    // Technical terms (Medium Weight)
    {
      id: "tech-5",
      text: "Oxygen Evolution Reaction (OER)",
      weight: 80,
      type: "technical",
    },
    {
      id: "tech-6",
      text: "Potassium-Air Systems",
      weight: 78,
      type: "technical",
    },
    {
      id: "tech-7",
      text: "Aluminum-Air Technology",
      weight: 76,
      type: "technical",
    },
    {
      id: "tech-8",
      text: "Nanostructured Materials",
      weight: 74,
      type: "technical",
    },
    {
      id: "tech-9",
      text: "Hybrid Electrolyte Systems",
      weight: 72,
      type: "technical",
    },
    {
      id: "tech-10",
      text: "Round-Trip Efficiency",
      weight: 70,
      type: "technical",
    },
    {
      id: "tech-11",
      text: "Dendrite Growth Mitigation",
      weight: 68,
      type: "technical",
    },
    // Technical terms (Lower Weight) - Ongoing challenges
    {
      id: "tech-12",
      text: "Metal Anode Corrosion",
      weight: 65,
      type: "technical",
    },
    {
      id: "tech-13",
      text: "Parasitic Corrosion",
      weight: 62,
      type: "technical",
    },
    {
      id: "tech-14",
      text: "Hydrogen Evolution",
      weight: 60,
      type: "technical",
    },
    {
      id: "tech-15",
      text: "Coulomb Efficiency",
      weight: 58,
      type: "technical",
    },
    {
      id: "tech-16",
      text: "Electrolyte Stability",
      weight: 56,
      type: "technical",
    },
  ],
};

const FastestRisingTopics: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="w-full h-full flex flex-col bg-background">
      {/* Header */}
      <motion.div
        className="relative overflow-hidden px-6 py-4 border-b border-border flex items-center gap-4 bg-background"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
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
        <button
          onClick={() => navigate("/")}
          className="relative z-10 p-2 hover:bg-accent rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="relative z-10">
          <h1 className="text-2xl font-bold text-foreground">
            Fastest Rising Topics
          </h1>
          <p className="text-sm text-muted-foreground">
            Deep Dive: Topic Nebula Visualization
          </p>
        </div>
      </motion.div>

      {/* Main Content - Full page visualization */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        <motion.div
          className="flex-1 w-full p-4 relative bg-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="w-full h-full bg-white">
            <TopicNebula data={mockTopicData} />
          </div>

          {/* Legend */}
          <div className="absolute bottom-8 right-8 bg-white/90 backdrop-blur-sm border border-border rounded-lg p-4 shadow-sm">
            <h3 className="text-sm font-semibold mb-3">Legend</h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#FDBA74' }} />
                <span>Main Topic</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#93C5FD' }} />
                <span>Applications</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#D8B4FE' }} />
                <span>Technical Terms</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Circle size indicates frequency
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default FastestRisingTopics;
