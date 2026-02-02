import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Send,
  Sparkles,
  Loader2,
  RotateCcw,
  X,
  Database,
  Settings,
  Lightbulb,
  CheckCircle,
} from 'lucide-react';
import type { ChartData, ChartConfig } from '../../types';
import {
  sendChatMessage,
  generateMessageId,
  type ChatMessage,
} from '../../services/chartChatService';
import { useAssistant } from '../../contexts/AssistantProvider';
import './ChatPanel.css';

interface ChatPanelProps {
  data: ChartData;
  config: ChartConfig;
  onDataChange: (data: ChartData) => void;
  onConfigChange: (config: ChartConfig) => void;
}

export function ChatPanel({
  data,
  config,
  onDataChange,
  onConfigChange,
}: ChatPanelProps) {
  const { isOpen, close } = useAssistant();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await sendChatMessage(
        userMessage.content,
        data,
        config,
        messages
      );

      if (response.updatedData) {
        onDataChange(response.updatedData);
      }

      if (response.updatedConfig) {
        onConfigChange({ ...config, ...response.updatedConfig });
      }

      const isInsightOnly = !response.changes.dataModified && !response.changes.configModified;
      const assistantMessage: ChatMessage = {
        id: generateMessageId(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
        changes: isInsightOnly
          ? { ...response.changes, summary: 'insight' }
          : response.changes,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: generateMessageId(),
        role: 'assistant',
        content: "Sorry, I encountered an error processing your request. Please try again.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      console.error('Chat error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleClearConversation = () => {
    setMessages([]);
  };

  const suggestions = [
    "What's the highest value in the data?",
    "Add a Total column",
    "Summarize this data",
    "Which category is performing best?",
  ];

  // Don't render if not open (toggle is in the header)
  if (!isOpen) {
    return null;
  }

  return (
    <div className="assistant-panel open">
      {/* Header */}
      <div className="assistant-header">
        <div className="assistant-header-title">
          <div className="assistant-icon-wrapper">
            <Sparkles size={16} />
          </div>
          <span>Epic Assistant</span>
        </div>
        <div className="assistant-header-actions">
          <button
            className="assistant-header-btn"
            onClick={handleClearConversation}
            title="Clear conversation"
          >
            <RotateCcw size={16} />
          </button>
          <button
            className="assistant-header-btn"
            onClick={close}
            title="Close panel"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="assistant-messages">
        {messages.length === 0 && (
          <div className="assistant-empty-state">
            <div className="assistant-empty-icon">
              <Sparkles size={24} />
            </div>
            <h4>How can I help?</h4>
            <p>
              I can analyze your data, add computed columns, change chart settings, and more.
            </p>
            <div className="assistant-suggestions">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="assistant-suggestion-card"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`assistant-message ${message.role}`}
          >
            {message.role === 'assistant' && (
              <div className="assistant-avatar">
                <Sparkles size={14} />
              </div>
            )}
            <div className="assistant-message-bubble">
              {/* Change badges */}
              {message.changes && (
                <div className="assistant-changes">
                  {!message.changes.dataModified && !message.changes.configModified && message.changes.summary === 'insight' && (
                    <span className="change-badge insight">
                      <Lightbulb size={10} />
                      Insight
                    </span>
                  )}
                  {message.changes.dataModified && (
                    <span className="change-badge data">
                      <Database size={10} />
                      <CheckCircle size={10} />
                      Data modified
                    </span>
                  )}
                  {message.changes.configModified && (
                    <span className="change-badge config">
                      <Settings size={10} />
                      <CheckCircle size={10} />
                      Settings changed
                    </span>
                  )}
                </div>
              )}

              {/* Message content with markdown */}
              <div className="assistant-message-content">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>

              {/* Timestamp */}
              <div className="assistant-timestamp">
                {message.timestamp.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
            {message.role === 'user' && (
              <div className="user-avatar">
                U
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="assistant-message assistant">
            <div className="assistant-avatar">
              <Sparkles size={14} />
            </div>
            <div className="assistant-message-bubble loading">
              <Loader2 size={16} className="spin" />
              <span>Thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="assistant-input-area">
        <div className="assistant-input-row">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything..."
            className="assistant-input"
            rows={1}
            disabled={isLoading}
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            className="assistant-send-btn"
          >
            {isLoading ? (
              <Loader2 size={18} className="spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
        <p className="assistant-input-hint">
          Press Enter to send
        </p>
      </div>
    </div>
  );
}
