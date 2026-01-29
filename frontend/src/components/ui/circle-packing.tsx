import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

export interface CircleNode {
  name: string;
  value?: number;
  children?: CircleNode[];
  type?: 'core' | 'application' | 'technical';
}

interface CirclePackingProps {
  data: CircleNode;
  width?: number;
  height?: number;
}

export const CirclePacking: React.FC<CirclePackingProps> = ({
  data,
  width = 800,
  height = 600,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [focusedNode, setFocusedNode] = useState<any>(null);

  useEffect(() => {
    if (!svgRef.current || !data) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const diameter = Math.min(width, height);
    const g = svg
      .append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    const color = d3.scaleOrdinal<string>()
      .domain(['core', 'application', 'technical'])
      .range(['#FDBA74', '#93C5FD', '#D8B4FE']);

    const pack = d3.pack<CircleNode>()
      .size([diameter - 4, diameter - 4])
      .padding(3);

    const root = d3.hierarchy(data)
      .sum((d) => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const nodes = pack(root).descendants();

    let focus = root;
    let view: [number, number, number];

    // Add gradients for pastel grainy effect
    const defs = svg.append('defs');

    const createGradient = (id: string, color1: string, color2: string) => {
      const gradient = defs.append('radialGradient')
        .attr('id', id);
      gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', color1)
        .attr('stop-opacity', 0.6);
      gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', color2)
        .attr('stop-opacity', 0.4);
    };

    createGradient('gradient-orange', '#FDBA74', '#FED7AA');
    createGradient('gradient-blue', '#93C5FD', '#BFDBFE');
    createGradient('gradient-purple', '#D8B4FE', '#E9D5FF');

    const circle = g.selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('class', (d: any) => d.parent ? (d.children ? 'node' : 'node node--leaf') : 'node node--root')
      .style('fill', (d: any) => {
        if (!d.parent) return 'url(#gradient-orange)'; // Root is always orange
        if (d.children) {
          if (d.data.type === 'application') return 'url(#gradient-blue)';
          if (d.data.type === 'technical') return 'url(#gradient-purple)';
          return 'url(#gradient-orange)';
        }
        if (d.data.type === 'application') return 'url(#gradient-blue)';
        if (d.data.type === 'technical') return 'url(#gradient-purple)';
        return 'url(#gradient-orange)';
      })
      .style('stroke', '#fff')
      .style('stroke-width', 2)
      .on('mouseover', function() {
        d3.select(this).style('stroke', '#FDBA74').style('stroke-width', 3);
      })
      .on('mouseout', function() {
        d3.select(this).style('stroke', '#fff').style('stroke-width', 2);
      })
      .on('click', (event, d: any) => {
        if (focus !== d) {
          zoom(event, d);
          event.stopPropagation();
        }
      });

    const text = g.selectAll('text')
      .data(nodes)
      .join('text')
      .attr('class', 'label')
      .attr('dy', (d: any) => {
        // Position root text at top of circle to avoid overlap
        if (d === root) return -d.r * 0.7; // Top center position
        return 0;
      })
      .style('fill-opacity', (d: any) => {
        // Initially show root and its direct children only
        return (d === root || d.parent === root) ? 1 : 0;
      })
      .style('display', 'inline')
      .style('font-size', (d: any) => {
        if (d === root) return '20px';
        if (d.parent === root) return '16px';
        if (d.r < 20) return '9px';
        if (d.r < 30) return '10px';
        return '11px';
      })
      .style('font-weight', (d: any) => (d === root ? '700' : d.parent === root ? '600' : '500'))
      .style('text-anchor', 'middle')
      .style('dominant-baseline', 'middle')
      .style('pointer-events', 'none')
      .style('fill', '#1F2937')
      .text((d: any) => {
        const name = d.data.name;
        const radius = d.r;

        // Show all text - let CSS handle overflow
        // Truncate only for very small circles
        if (radius < 10) return '';
        if (radius < 30) {
          // For small circles, show first few chars
          const maxChars = Math.max(3, Math.floor(radius / 2));
          if (name.length > maxChars + 2) {
            return name.substring(0, maxChars) + '..';
          }
        }
        return name;
      });

    svg.on('click', (event) => zoom(event, root));

    // Initial zoom
    zoomTo([root.x, root.y, root.r * 2]);

    function zoomTo(v: [number, number, number]) {
      const k = diameter / v[2];
      view = v;

      // Transform circles
      circle
        .attr('transform', (d: any) => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`)
        .attr('r', (d: any) => d.r * k);

      // Transform text
      text
        .attr('transform', (d: any) => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`)
        .attr('dy', (d: any) => {
          // Maintain top position for root text during zoom
          if (d === root) return -d.r * k * 0.7;
          return 0;
        })
        .style('font-size', (d: any) => {
          let baseSize = 11;
          if (d === root) baseSize = 20;
          else if (d.parent === root) baseSize = 16;
          else if (d.r < 20) baseSize = 9;
          else if (d.r < 30) baseSize = 10;

          // Scale font size inversely with zoom to keep text readable
          return `${Math.max(9, baseSize / Math.sqrt(k))}px`;
        });
    }

    function zoom(event: any, d: any) {
      focus = d;
      setFocusedNode(d);

      const transition = svg.transition()
        .duration(750)
        .tween('zoom', () => {
          const i = d3.interpolateZoom(view, [focus.x, focus.y, focus.r * 2]);
          return (t: number) => zoomTo(i(t));
        });

      // Update text visibility based on zoom level
      text
        .transition(transition as any)
        .style('fill-opacity', (node: any) => {
          // Always show text for visible nodes
          if (node === focus) return 1;
          if (node.parent === focus) return 1;
          // Hide text for nodes outside focus
          return 0;
        });
    }

  }, [data, width, height]);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-white">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{ cursor: 'pointer', background: '#ffffff' }}
      />
      <p className="text-xs text-muted-foreground mt-4">
        Click on circles to zoom • Click background to zoom out
      </p>
    </div>
  );
};
