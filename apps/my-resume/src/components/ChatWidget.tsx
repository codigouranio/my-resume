import { useState, useRef, useEffect } from 'react';

// API Configuration
// In Rsbuild, use PUBLIC_ prefix for environment variables
const API_URL = (import.meta.env as any).PUBLIC_LLM_API_URL || 'http://localhost:5000';

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      type: 'bot',
      text: "Hi! I'm Jose's AI assistant. Feel free to ask me about his career, skills, or experience!"
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = { type: 'user', text: inputValue };
    setMessages([...messages, userMessage]);
    const currentQuestion = inputValue;
    setInputValue('');
    setIsLoading(true);

    try {
      // Call Flask API
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: currentQuestion }),
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
    }
  };

  const getBotResponseFallback = (question: string): string => {
    if (question.includes('experience') || question.includes('work')) {
      return "Jose has over 15 years of experience in full-stack development, working with companies like Asurion, Interactions LLC, Carbon Black, and more. He specializes in TypeScript, React, Node.js, and AWS infrastructure.";
    } else if (question.includes('skill') || question.includes('technology')) {
      return "Jose's core skills include: TypeScript, JavaScript, Python, React, Node.js, AWS (Lambda, API Gateway, CDK), Docker, Kubernetes, and GraphQL. He's also experienced in system design and microservices architecture.";
    } else if (question.includes('contact') || question.includes('email') || question.includes('reach')) {
      return "You can reach out to Jose through LinkedIn or check the contact section. Would you like to know more about any specific project or experience?";
    } else if (question.includes('education')) {
      return "Jose has an AS in Electronic Products Development and is currently pursuing a BS in Mathematics at UNED. He also continues learning through platforms like LeetCode, AlgoMonster, and Coursera.";
    } else if (question.includes('project')) {
      return "Jose has worked on notable projects including building a multi-tenant platform at Interactions, developing an API Gateway handling millions of events per minute at Carbon Black, and creating a flagship threat detection interface. Check out the YouTube demo in the resume!";
    } else {
      return "That's a great question! Feel free to ask me about Jose's experience, skills, projects, or education. I'm here to help you learn more about his career!";
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
                className={`chat ${message.type === 'user' ? 'chat-end' : 'chat-start'}`}
              >
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
              type="text"
              placeholder="Ask about Jose's experience..."
              className="input input-bordered w-full"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
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
