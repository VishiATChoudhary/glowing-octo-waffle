import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CirclePacking, CircleNode } from "@/components/ui/circle-packing";

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

  // Convert TopicNebulaData to hierarchical CircleNode format
  const circleData: CircleNode = React.useMemo(() => {
    if (!data) return { name: "Root", children: [] };

    // Group related nodes by type
    const applicationNodes = data.relatedNodes
      .filter(node => node.type === 'application')
      .map(node => ({
        name: node.text,
        value: node.weight,
        type: node.type
      }));

    const technicalNodes = data.relatedNodes
      .filter(node => node.type === 'technical')
      .map(node => ({
        name: node.text,
        value: node.weight,
        type: node.type
      }));

    return {
      name: data.centralNode.text,
      type: 'core',
      children: [
        ...(applicationNodes.length > 0 ? [{
          name: 'Applications',
          type: 'application' as const,
          children: applicationNodes
        }] : []),
        ...(technicalNodes.length > 0 ? [{
          name: 'Technical',
          type: 'technical' as const,
          children: technicalNodes
        }] : [])
      ]
    };
  }, [data]);

  return (
    <motion.div
      ref={containerRef}
      className="w-full h-full relative bg-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      {dimensions.width > 0 && dimensions.height > 0 && (
        <CirclePacking
          data={circleData}
          width={dimensions.width}
          height={dimensions.height}
        />
      )}
    </motion.div>
  );
};

export default TopicNebula;
