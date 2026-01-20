import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TopicNebula, { TopicNebulaData } from "@/components/TopicNebula";

// Mock data for Metal-Air Batteries topic
const mockTopicData: TopicNebulaData = {
  centralNode: {
    id: "central-1",
    text: "Metal-Air Batteries",
    weight: 100,
    type: "core",
  },
  relatedNodes: [
    // Application/Startup examples (High Weight)
    {
      id: "app-1",
      text: "Heavy-lift Drones",
      weight: 85,
      type: "application",
    },
    {
      id: "app-2",
      text: "eVTOL",
      weight: 90,
      type: "application",
    },
    {
      id: "app-3",
      text: "Grid Storage",
      weight: 88,
      type: "application",
    },
    {
      id: "app-4",
      text: "Urban Air Mobility (UAM)",
      weight: 82,
      type: "application",
    },
    {
      id: "app-5",
      text: "Long-range IoT",
      weight: 78,
      type: "application",
    },
    {
      id: "app-6",
      text: "Emergency Backup Power",
      weight: 75,
      type: "application",
    },
    // Technical examples (High Weight)
    {
      id: "tech-1",
      text: "Zinc-Air",
      weight: 85,
      type: "technical",
    },
    {
      id: "tech-2",
      text: "Bifunctional Catalysts",
      weight: 82,
      type: "technical",
    },
    // Technical examples (Medium Weight)
    {
      id: "tech-3",
      text: "High Energy Density",
      weight: 70,
      type: "technical",
    },
    {
      id: "tech-4",
      text: "Rechargeability Challenges",
      weight: 65,
      type: "technical",
    },
    {
      id: "tech-5",
      text: "Cycle Life Optimization",
      weight: 68,
      type: "technical",
    },
    {
      id: "tech-6",
      text: "Air Electrode Design",
      weight: 72,
      type: "technical",
    },
    // Technical examples (Low Weight)
    {
      id: "tech-7",
      text: "Dendrite Formation",
      weight: 55,
      type: "technical",
    },
    {
      id: "tech-8",
      text: "Aqueous Electrolyte",
      weight: 58,
      type: "technical",
    },
    {
      id: "tech-9",
      text: "Carbon Dioxide Management",
      weight: 52,
      type: "technical",
    },
    {
      id: "tech-10",
      text: "Oxygen Reduction Reaction",
      weight: 60,
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
        className="px-6 py-4 border-b border-border flex items-center gap-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <button
          onClick={() => navigate("/")}
          className="p-2 hover:bg-accent rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Fastest Rising Topics
          </h1>
          <p className="text-sm text-muted-foreground">
            Deep Dive: Topic Nebula Visualization
          </p>
        </div>
      </motion.div>

      {/* Main Content - Two sections */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Section: Topic Nebula - 50% height */}
        <motion.div
          className="h-1/2 w-full border-b border-border p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="w-full h-full">
            <TopicNebula data={mockTopicData} />
          </div>
        </motion.div>

        {/* Bottom Section: Reserved for future content - 50% height */}
        <motion.div
          className="h-1/2 w-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          {/* Left blank for future content */}
        </motion.div>
      </div>
    </div>
  );
};

export default FastestRisingTopics;
