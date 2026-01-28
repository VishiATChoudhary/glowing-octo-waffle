import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChatMessage } from '@/types';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  title?: string;
  subtitle?: string;
  showGradientHeader?: boolean;
}

const ChatInterface = ({
  messages,
  onSendMessage,
  isLoading = false,
  placeholder = "Ask about academic papers...",
  title = "Query Papers",
  subtitle = "Search across your enabled integrations",
  showGradientHeader = false,
}: ChatInterfaceProps) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      {showGradientHeader ? (
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
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>
      ) : (
        <div className="p-6 border-b border-border">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-muted-foreground text-sm max-w-md">
              Start by asking a question about academic papers. Try something like:
            </p>
            <div className="mt-4 space-y-2">
              {[
                "Find papers on transformer architectures",
                "What are the latest advances in NLP?",
                "Show me papers by Geoffrey Hinton",
              ].map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => onSendMessage(suggestion)}
                  className="block w-full text-left px-4 py-2 text-sm border border-border rounded hover:bg-secondary transition-colors"
                >
                  "{suggestion}"
                </button>
              ))}
            </div>
          </div>
        ) : (
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
                  className={`max-w-[80%] px-4 py-3 rounded ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
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
        )}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-secondary px-4 py-3 rounded">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-border">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={!input.trim() || isLoading} size="icon">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ChatInterface;
