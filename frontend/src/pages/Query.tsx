import { useState } from 'react';
import ChatInterface from '@/components/ChatInterface';
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
    <div className="h-screen">
      <ChatInterface
        messages={messages}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        title="Query Papers"
        subtitle="Search across arXiv, Google Scholar, and Elsevier"
        placeholder="Search for papers, authors, or topics..."
      />
    </div>
  );
};

export default Query;
