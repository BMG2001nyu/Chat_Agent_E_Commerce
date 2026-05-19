'use client';

import { useState, useRef, useEffect } from 'react';
import { marked } from 'marked';
import ProductCard from './ProductCard';
import TypingIndicator from './TypingIndicator';

const QUICK_ACTIONS = [
  { label: '🧊 Ice maker not working', prompt: 'The ice maker on my Whirlpool refrigerator is not working. How can I fix it?' },
  { label: '🚿 Dishwasher not draining', prompt: 'My dishwasher has standing water in the bottom after a cycle. It is not draining.' },
  { label: '🔍 Check part compatibility', prompt: 'I need to check if part PS11752778 is compatible with my appliance.' },
  { label: '🔧 Installation help', prompt: 'How do I install part number PS11752778?' },
  { label: '🧹 Dishes not getting clean', prompt: 'My dishwasher is running but dishes are not coming out clean.' },
  { label: '📦 Track my order', prompt: 'I want to track my order PS-100422.' },
];

marked.use({ breaks: true });

function renderMarkdown(text) {
  return { __html: marked.parse(text) };
}

function InstallationGuideCard({ guide }) {
  return (
    <div className="guide-card">
      <div className="guide-header">
        <span className="guide-icon">🔧</span>
        <div>
          <h4>{guide.title}</h4>
          <div className="guide-meta">
            <span>⏱ {guide.estimated_time}</span>
            <span>· Difficulty: {guide.difficulty}</span>
          </div>
        </div>
      </div>

      {guide.safety && (
        <div className="guide-safety">⚠️ {guide.safety}</div>
      )}

      <div className="guide-tools">
        <strong>Tools needed:</strong> {guide.tools_needed.join(', ')}
      </div>

      <ol className="guide-steps">
        {guide.steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>

      {guide.tips?.length > 0 && (
        <div className="guide-tips">
          <strong>Pro tips:</strong>
          <ul>
            {guide.tips.map((tip, i) => (
              <li key={i}>{tip}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CompatibilityBadge({ result }) {
  if (!result) return null;
  return (
    <div className={`compatibility-badge ${result.compatible ? 'compatible' : 'incompatible'}`}>
      {result.compatible ? '✅ Compatible' : '❌ Not Compatible'}
      <span className="compat-model"> — Model {result.model_number}</span>
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`message-container ${isUser ? 'user-message-container' : 'assistant-message-container'}`}>
      {message.content && (
        <div className={`message ${isUser ? 'user-message' : 'assistant-message'}`}>
          <div dangerouslySetInnerHTML={renderMarkdown(message.content)} />
        </div>
      )}

      {!isUser && message.compatibilityResult && (
        <CompatibilityBadge result={message.compatibilityResult} />
      )}

      {!isUser && message.installationGuide?.steps && (
        <InstallationGuideCard guide={message.installationGuide} />
      )}

      {!isUser && message.products?.length > 0 && (
        <div className="product-list">
          {message.products.map((product) => (
            <ProductCard key={product.part_number} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ChatWindow() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hi! I'm the **PartSelect** assistant. I can help you find **refrigerator and dishwasher parts**, check compatibility with your model, provide installation guides, and troubleshoot issues.\n\nHow can I help you today?",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const showQuickActions = messages.length === 1;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (text) => {
    const userText = (text || input).trim();
    if (!userText || loading) return;

    const userMessage = { role: 'user', content: userText };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      // Only send role + content to the API (strip frontend-only fields)
      const apiMessages = updatedMessages.map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!res.ok) {
        throw new Error(`API returned ${res.status}`);
      }

      const data = await res.json();
      setMessages((prev) => [...prev, data]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error connecting to the service. Please try again.' },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="chat-wrapper">
      <div className="messages-container">
        {messages.map((message, index) => (
          <MessageBubble key={index} message={message} />
        ))}

        {showQuickActions && (
          <div className="quick-actions">
            <p className="quick-actions-label">Common questions:</p>
            <div className="quick-actions-grid">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  className="quick-action-btn"
                  onClick={() => sendMessage(action.prompt)}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      <div className="input-area">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about refrigerator or dishwasher parts..."
          disabled={loading}
          autoComplete="off"
        />
        <button
          className="send-button"
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
        >
          {loading ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
