import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import RuixenQueryBox from '@/components/ui/ruixen-query-box';
import { ChatMessage } from '@/types';
import { useQuery } from '@/contexts/QueryContext';

const Query = () => {
  const { messages, addMessage } = useQuery();
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async (content: string) => {
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    addMessage(userMessage);
    setIsLoading(true);

    // Simulate AI response
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const assistantMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: `I found several relevant papers related to "${content}". Here are some highlights:\n\n1. "Attention Is All You Need" (2017) - A foundational paper on transformer architecture with 85,000 citations.\n\n2. "BERT: Pre-training of Deep Bidirectional Transformers" (2018) - Introduces bidirectional training for language models.\n\n3. "Deep Residual Learning" (2015) - Revolutionary approach to training very deep networks.\n\nWould you like me to add these to your graph visualization?`,
      timestamp: new Date(),
    };

    addMessage(assistantMessage);
    setIsLoading(false);
  };

  return (
    <div className="h-screen flex flex-col relative overflow-hidden">
      {/* Subtle background gradient */}
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(to bottom, #fafaf9 0%, #ffffff 50%, #fafaf9 100%)'
      }} />

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 relative z-10">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            {/* Waffle Icon */}
            <div className="text-8xl mb-6">🧇</div>

            {/* Welcome Text */}
            <h2 className="text-3xl font-semibold mb-2">Waffles.Chat</h2>
            <p className="text-muted-foreground text-sm max-w-md mb-8">
              Ask questions about academic papers and research
            </p>

            {/* Example Question Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mb-6">
              {[
                {
                  icon: "📊",
                  title: "Find Papers",
                  description: "Search for papers on transformer architectures",
                  query: "Find papers on transformer architectures"
                },
                {
                  icon: "🔬",
                  title: "Latest Research",
                  description: "What are the latest advances in NLP?",
                  query: "What are the latest advances in NLP?"
                },
                {
                  icon: "👨‍🔬",
                  title: "By Author",
                  description: "Show me papers by Geoffrey Hinton",
                  query: "Show me papers by Geoffrey Hinton"
                },
              ].map((card, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(card.query)}
                  className="p-4 border border-border rounded-xl hover:border-amber-500 hover:shadow-md transition-all text-left bg-white"
                >
                  <div className="text-3xl mb-2">{card.icon}</div>
                  <h3 className="font-semibold text-sm mb-1">{card.title}</h3>
                  <p className="text-xs text-muted-foreground">{card.description}</p>
                </button>
              ))}
            </div>

            {/* Disclaimer */}
            <p className="text-xs text-muted-foreground/70">
              Results are based on available academic databases. Please verify important information.
            </p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4 py-8">
            <AnimatePresence mode="popLayout">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] px-4 py-3 rounded-lg relative overflow-hidden ${
                      message.role === 'user'
                        ? 'text-zinc-900 border border-amber-500'
                        : 'bg-secondary text-secondary-foreground'
                    }`}
                    style={message.role === 'user' ? { backgroundColor: 'white' } : {}}
                  >
                    {message.role === 'user' && (
                      <div className="absolute inset-0 overflow-hidden">
                        <div className="absolute inset-0 blur-3xl">
                          <div
                            className="absolute w-[250px] h-[250px] rounded-full opacity-40"
                            style={{
                              background: '#FDE047',
                              top: '-50%',
                              left: '5%',
                            }}
                          />
                          <div
                            className="absolute w-[300px] h-[300px] rounded-full opacity-40"
                            style={{
                              background: '#FBBF24',
                              top: '-60%',
                              left: '40%',
                            }}
                          />
                          <div
                            className="absolute w-[350px] h-[350px] rounded-full opacity-50"
                            style={{
                              background: '#F59E0B',
                              top: '-70%',
                              right: '-10%',
                            }}
                          />
                        </div>
                      </div>
                    )}
                    <p className="text-sm whitespace-pre-wrap relative z-10">{message.content}</p>
                    <p className="text-xs opacity-60 mt-1 relative z-10">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Query Box */}
      <div className="border-t border-border/50 relative z-10" style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(10px)' }}>
        <RuixenQueryBox
          onSend={handleSendMessage}
          placeholder="Ask about papers, authors, or research topics..."
          disabled={isLoading}
          showGradient={true}
        />
      </div>
    </div>
  );
};

export default Query;
