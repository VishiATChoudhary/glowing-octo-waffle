import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import GraphVisualization from '@/components/GraphVisualization';
import ChatInterface from '@/components/ChatInterface';
import NodePopup from '@/components/NodePopup';
import { ChatMessage, SearchSessionState } from '@/types';
import { generateGraphData } from '@/data/mockData';
import { useGraph } from '@/contexts/GraphContext';

const Graph = () => {
  const location = useLocation();
  const navigationState = location.state as SearchSessionState | null;

  const {
    messages,
    addMessage,
    selectedNode,
    setSelectedNode,
    searchSession,
    setSearchSession,
  } = useGraph();

  const [isLoading, setIsLoading] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Update context when navigating with new search data
  useEffect(() => {
    if (navigationState?.graphData) {
      setSearchSession(navigationState);
      // Clear the navigation state to prevent re-applying on subsequent renders
      window.history.replaceState({}, document.title);
    }
  }, [navigationState, setSearchSession]);

  // Use context searchSession if available, otherwise use default
  const graphData = searchSession?.graphData ?? generateGraphData();
  const currentSession = searchSession;

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const handleSendMessage = async (content: string) => {
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    addMessage(userMessage);
    setIsLoading(true);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const researcherCount = graphData.nodes.filter((n) => n.type === 'researcher').length;
    const paperCount = graphData.nodes.filter((n) => n.type === 'paper').length;

    const assistantMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: `Based on the graph data, I can see:\n\n• ${researcherCount} researchers in the network\n• ${paperCount} papers with connections\n• Dr. Sarah Chen and Prof. James Miller have the most collaborations\n\nThe most cited paper is "Deep Residual Learning" with 120,000 citations. Click on any node to see detailed statistics.`,
      timestamp: new Date(),
    };

    addMessage(assistantMessage);
    setIsLoading(false);
  };

  return (
    <div className="h-screen flex">
      {/* Graph Panel */}
      <div className="flex-1 flex flex-col">
        <div className="relative overflow-hidden p-6 border-b border-border" style={{ backgroundColor: 'white' }}>
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
            <h2 className="text-lg font-semibold">
              {currentSession?.expansionType === 'researchers' ? 'Collaboration Network' : 'Knowledge Graph'}
            </h2>
            <p className="text-sm text-muted-foreground">
            {currentSession?.expansionType === 'researchers' ? (
              <>
                {graphData.nodes.length} researchers •{' '}
                {graphData.links.length} collaboration{graphData.links.length !== 1 ? 's' : ''}
              </>
            ) : currentSession?.searchQuery ? (
              <>
                Search: "{currentSession.searchQuery}" - {currentSession.seedPaperCount} seed papers expanded to{' '}
                {currentSession.totalPaperCount} papers
                {currentSession.wasTruncated && ' (truncated at 50)'}
              </>
            ) : (
              <>
                {graphData.nodes.filter((n) => n.type === 'researcher').length} researchers •{' '}
                {graphData.nodes.filter((n) => n.type === 'paper').length} papers
              </>
            )}
          </p>
          </div>
        </div>

        <div ref={containerRef} className="flex-1 relative">
          <GraphVisualization
            data={graphData}
            onNodeClick={setSelectedNode}
            width={dimensions.width}
            height={dimensions.height}
          />

          {/* Legend */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-4 left-4 bg-card border border-border p-3 rounded shadow-sm"
          >
            {currentSession?.expansionType === 'researchers' ? (
              // Simplified legend for researcher-only graphs
              <>
                <div className="flex items-center gap-2 text-xs mb-2">
                  <div className="w-3 h-3 rounded-full bg-node-researcher border border-node-researcher-border" />
                  <span>Researcher</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-4 h-0.5 bg-blue-500 rounded" />
                  <span>Collaboration</span>
                </div>
              </>
            ) : (
              // Full legend for mixed graphs
              <>
                <p className="text-xs font-medium mb-2">Nodes</p>
                <div className="flex items-center gap-4 text-xs mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-node-researcher border border-node-researcher-border" />
                    <span>Researcher</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-node-paper border border-node-paper-border" />
                    <span>Paper</span>
                  </div>
                </div>
                <p className="text-xs font-medium mb-2">Links</p>
                <div className="flex flex-col gap-1 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5 bg-blue-500 rounded" />
                    <span>Co-authorship</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5 bg-orange-500 rounded" />
                    <span>Citation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-px bg-gray-300 rounded" />
                    <span>Authored</span>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </div>
      </div>

      {/* Chat Panel */}
      <div className="w-96 border-l border-border">
        <ChatInterface
          messages={messages}
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          title="Query Graph"
          subtitle="Ask questions about the knowledge graph"
          placeholder="Ask about researchers or papers..."
        />
      </div>

      {/* Node Popup */}
      <NodePopup node={selectedNode} onClose={() => setSelectedNode(null)} />
    </div>
  );
};

export default Graph;
