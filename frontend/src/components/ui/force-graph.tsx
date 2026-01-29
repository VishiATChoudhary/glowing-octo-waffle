import React, { useEffect, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

export interface GraphNode {
  id: string;
  text: string;
  weight: number;
  type: 'core' | 'application' | 'technical';
}

export interface GraphLink {
  source: string;
  target: string;
  distance: number;
}

export interface ForceGraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface ForceGraphProps {
  data: ForceGraphData;
  width?: number;
  height?: number;
}

export const ForceGraph: React.FC<ForceGraphProps> = ({
  data,
  width = 800,
  height = 600,
}) => {
  const fgRef = useRef<any>();

  useEffect(() => {
    if (fgRef.current) {
      // Zoom to fit after initial render
      fgRef.current.zoomToFit(400);
    }
  }, [data]);

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'core':
        return '#F59E0B'; // Amber - main keyword
      case 'application':
        return '#3B82F6'; // Blue - applications
      case 'technical':
        return '#8B5CF6'; // Purple - technical terms
      default:
        return '#6B7280'; // Gray
    }
  };

  const getNodeSize = (node: GraphNode) => {
    if (node.type === 'core') {
      return 12; // Larger for central node
    }
    // Scale based on weight
    return 4 + (node.weight / 100) * 6;
  };

  return (
    <ForceGraph2D
      ref={fgRef}
      graphData={data}
      width={width}
      height={height}
      nodeId="id"
      nodeLabel={(node: any) => node.text}
      nodeVal={(node: any) => getNodeSize(node)}
      nodeColor={(node: any) => getNodeColor(node.type)}
      nodeCanvasObject={(node: any, ctx, globalScale) => {
        const label = node.text;
        const fontSize = node.type === 'core' ? 14 / globalScale : 12 / globalScale;
        ctx.font = `${fontSize}px Sans-Serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = getNodeColor(node.type);

        // Draw node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, getNodeSize(node), 0, 2 * Math.PI, false);
        ctx.fill();

        // Draw label
        ctx.fillStyle = '#1F2937';
        ctx.fillText(label, node.x, node.y + getNodeSize(node) + fontSize + 2);
      }}
      linkColor={() => '#D1D5DB'}
      linkWidth={1}
      linkDirectionalParticles={0}
      d3AlphaDecay={0.02}
      d3VelocityDecay={0.3}
      cooldownTicks={100}
      onEngineStop={() => fgRef.current?.zoomToFit(400)}
      backgroundColor="transparent"
    />
  );
};
