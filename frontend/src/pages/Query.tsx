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
    <div className="h-screen flex flex-col">
      {/* Header */}
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
          <h2 className="text-lg font-semibold">Query Papers</h2>
          <p className="text-sm text-muted-foreground">
            Search across arXiv, Google Scholar, and Elsevier
          </p>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-muted-foreground text-sm max-w-md mb-4">
              Start by asking a question about academic papers. Try something like:
            </p>
            <div className="space-y-2">
              {[
                "Find papers on transformer architectures",
                "What are the latest advances in NLP?",
                "Show me papers by Geoffrey Hinton",
              ].map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(suggestion)}
                  className="block w-full text-left px-4 py-2 text-sm border border-border rounded hover:bg-secondary transition-colors"
                >
                  "{suggestion}"
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
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
                    className={`max-w-[80%] px-4 py-3 rounded-lg ${
                      message.role === 'user'
                        ? 'bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 text-zinc-900'
                        : 'bg-secondary text-secondary-foreground'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <p className="text-xs opacity-60 mt-1">
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
      <div className="border-t border-border">
        <RuixenQueryBox
          onSend={handleSendMessage}
          placeholder="Search for papers, authors, or topics..."
          disabled={isLoading}
        />
      </div>
    </div>
  );
};

export default Query;
