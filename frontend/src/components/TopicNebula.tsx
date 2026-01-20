import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { WordcloudChart, WordData } from "@/components/ui/word-cloud";

export interface NebulaNode {
  id: string;
  text: string;
  weight: number;
  type: "core" | "application" | "technical";
}

export interface TopicNebulaData {
  centralNode: NebulaNode;
  relatedNodes: NebulaNode[];
}

interface TopicNebulaProps {
  data: TopicNebulaData;
  width?: number;
  height?: number;
}

const TopicNebula: React.FC<TopicNebulaProps> = ({
  data,
  width = 1200,
  height = 600,
}) => {
  const [dimensions, setDimensions] = useState({ width, height });
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const container = containerRef.current;
        setDimensions({
          width: container.clientWidth,
          height: container.clientHeight,
        });
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Convert TopicNebulaData to WordData format
  const words: WordData[] = React.useMemo(() => {
    if (!data) return [];

    const allNodes = [data.centralNode, ...data.relatedNodes];
    return allNodes.map((node) => ({
      text: node.text,
      value: node.weight,
      type: node.type,
    }));
  }, [data]);

  return (
    <motion.div
      ref={containerRef}
      className="w-full h-full relative bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      {dimensions.width > 0 && dimensions.height > 0 && (
        <WordcloudChart
          width={dimensions.width}
          height={dimensions.height}
          words={words}
          showControls={false}
        />
      )}
    </motion.div>
  );
};

export default TopicNebula;
