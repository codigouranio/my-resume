import { useState, useRef, useEffect } from 'react';
import './ChatWidget.css';

// API Configuration
// In Rsbuild, use PUBLIC_ prefix for environment variables
const API_URL = import.meta.env.PUBLIC_LLM_API_URL || '/llm';

// Get resume slug from URL
const getResumeSlug = () => {
  if (typeof window === 'undefined') return null;
  const match = window.location.pathname.match(/\/resume\/([^/]+)/);
  return match ? match[1] : null;
};

const generateConversationId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const getConversationId = (slug: string | null) => {
  if (typeof window === 'undefined') return null;
  const key = `chat_conversation_id_${slug ?? 'default'}`;
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const created = generateConversationId();
  localStorage.setItem(key, created);
  return created;
};

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      type: 'bot',
      text: "Hi! I'm an AI assistant. Feel free to ask me about this person's career, skills, or experience!"
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const slug = getResumeSlug();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const focusInput = () => {
    if (!inputRef.current) return;
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    setConversationId(getConversationId(slug));
  }, [slug]);

  // Auto-focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => focusInput(), 100);
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = { type: 'user', text: inputValue };
    setMessages([...messages, userMessage]);
    const currentQuestion = inputValue;
    setInputValue('');
    setIsLoading(true);
    focusInput();

    try {
      // Call Flask API
      const activeConversationId = conversationId ?? getConversationId(slug);
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: currentQuestion,
          slug: slug,
          conversationId: activeConversationId
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const botResponse = {
        type: 'bot',
        text: data.response
      };
      setMessages(prev => [...prev, botResponse]);
    } catch (error) {
      console.error('Error calling LLM API:', error);
      // Fallback to local response if API fails
      const botResponse = {
        type: 'bot',
        text: "I'm having trouble connecting to the AI service right now. " +
          getBotResponseFallback(currentQuestion.toLowerCase())
      };
      setMessages(prev => [...prev, botResponse]);
    } finally {
      setIsLoading(false);
      focusInput();
    }
  };

  const getBotResponseFallback = (question: string): string => {
    if (question.includes('experience') || question.includes('work')) {
      return "This person has extensive experience in full-stack development, working with leading technology companies. They specialize in TypeScript, React, Node.js, and AWS infrastructure.";
    } else if (question.includes('skill') || question.includes('technology')) {
      // Fallback for skills question - should be answered by LLM with actual resume data
      return "I can help you learn about this person's skills and experience. Please ask me a specific question about their background!";
    } else if (question.includes('contact') || question.includes('email') || question.includes('reach')) {
      return "You can reach out through LinkedIn or check the contact section. Would you like to know more about any specific project or experience?";
    } else if (question.includes('education')) {
      return "Check the education section for academic background and certifications. Would you like to know more about their work experience instead?";
    } else if (question.includes('project')) {
      return "They have worked on notable projects including building multi-tenant platforms, developing API gateways handling millions of events, and creating threat detection interfaces. Check out the details in the resume!";
    } else {
      return "That's a great question! Feel free to ask me about their experience, skills, projects, or education. I'm here to help you learn more about their career!";
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Chat Button */}
      <button
        className={`chat-button ${isOpen ? 'hidden' : ''}`}
        onClick={() => setIsOpen(true)}
        aria-label="Open chat"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className="w-6 h-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
          />
        </svg>
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="chat-window">
          <div className="chat-header">
            <div className="flex items-center gap-2">
              <div className="avatar placeholder">
                <div className="bg-primary text-primary-content rounded-full w-8">
                  <span className="text-xs">JB</span>
                </div>
              </div>
              <div>
                <h3 className="font-bold text-sm">Career Assistant</h3>
                <p className="text-xs opacity-70">Ask me anything!</p>
              </div>
            </div>
            <button
              className="btn btn-ghost btn-sm btn-circle"
              onClick={() => setIsOpen(false)}
            >
              ✕
            </button>
          </div>

          <div className="chat-messages">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`chat ${message.type === 'user' ? 'chat-end' : 'chat-start'}`} onClick={() => inputRef.current?.focus()}              >
                <div className="chat-bubble">
                  {message.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="chat chat-start">
                <div className="chat-bubble">
                  <span className="loading loading-dots loading-sm"></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input">
            <input
              ref={inputRef}
              type="text"
              placeholder="Ask about their experience..."
              className="input input-bordered w-full"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              autoFocus
            />
            <button
              className="btn btn-primary btn-circle"
              onClick={handleSend}
              disabled={isLoading}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
