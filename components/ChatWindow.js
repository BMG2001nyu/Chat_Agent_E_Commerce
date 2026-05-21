'use client';

import { useState, useRef, useEffect } from 'react';
import { marked } from 'marked';
import ProductCard from './ProductCard';
import TypingIndicator from './TypingIndicator';

const QUICK_ACTIONS = [
  { label: 'Ice maker not working', prompt: 'The ice maker on my Whirlpool refrigerator is not working. How can I fix it?' },
  { label: 'Dishwasher not draining', prompt: 'My dishwasher has standing water in the bottom after a cycle. It is not draining.' },
  { label: 'Check compatibility', prompt: 'Is part PS11752778 compatible with my WDT780SAEM1 model?' },
  { label: 'Installation help', prompt: 'How do I install part number PS11752778?' },
  { label: 'Dishes not getting clean', prompt: 'My dishwasher is running but dishes are not coming out clean.' },
  { label: 'Track my order', prompt: 'I want to track my order PS-100422.' },
];

marked.use({ breaks: true });

function escapeMarkdownHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderMarkdown(text) {
  return { __html: marked.parse(escapeMarkdownHtml(text || '')) };
}

function CartSummary({ items }) {
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.price, 0);

  return (
    <div className="cart-summary">
      <div>
        <span className="cart-label">Session cart</span>
        <strong>{itemCount} item{itemCount === 1 ? '' : 's'}</strong>
      </div>
      <span className="cart-total">${subtotal.toFixed(2)}</span>
    </div>
  );
}

function TroubleshootCard({ result }) {
  if (!result) return null;

  return (
    <div className="insight-card">
      <div className="insight-kicker">Diagnosis</div>
      <h4>{result.diagnosis}</h4>
      <p>{result.explanation}</p>
      {result.check_first && (
        <div className="check-first">
          <strong>Check before buying:</strong> {result.check_first}
        </div>
      )}
      {result.model_number && <div className="insight-meta">Model context: {result.model_number}</div>}
    </div>
  );
}

function OrderStatusCard({ order }) {
  if (!order) return null;

  return (
    <div className="order-card">
      <div className="order-card-header">
        <span>Order {order.order_number}</span>
        <strong>{order.status}</strong>
      </div>
      <div className="order-card-body">
        {order.tracking ? (
          <p>{order.carrier} tracking: <strong>{order.tracking}</strong></p>
        ) : (
          <p>Tracking has not been assigned yet.</p>
        )}
        {order.delivered_on && <p>Delivered on {order.delivered_on}</p>}
        {order.estimated_delivery && <p>Estimated delivery: {order.estimated_delivery}</p>}
        {order.estimated_ship && <p>Estimated ship date: {order.estimated_ship}</p>}
        {order.items?.length > 0 && (
          <ul>
            {order.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
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
      {result.compatible ? 'Compatible' : 'Not Compatible'}
      <span className="compat-model"> — Model {result.model_number}</span>
    </div>
  );
}

function MessageBubble({ message, onAddToCart }) {
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

      {!isUser && message.troubleshootResult && (
        <TroubleshootCard result={message.troubleshootResult} />
      )}

      {!isUser && message.installationGuide?.steps && (
        <InstallationGuideCard guide={message.installationGuide} />
      )}

      {!isUser && message.orderStatus && (
        <OrderStatusCard order={message.orderStatus} />
      )}

      {!isUser && message.products?.length > 0 && (
        <div className="product-list">
          {message.products.map((product) => (
            <ProductCard key={product.part_number} product={product} onAddToCart={onAddToCart} />
          ))}
          {message.products.length > 1 && (
            <button
              className="add-all-btn"
              onClick={() => message.products.forEach((p) => onAddToCart(p))}
            >
              Add all {message.products.length} parts to cart
            </button>
          )}
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
  const [modelNumber, setModelNumber] = useState(null);

  // ── Persistent cart via localStorage ────────────────────
  const [cartItems, setCartItems] = useState([]);
  const [cartLoaded, setCartLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('ps_cart');
      if (saved) setCartItems(JSON.parse(saved));
    } catch {}
    setCartLoaded(true);
  }, []);

  useEffect(() => {
    if (cartLoaded) localStorage.setItem('ps_cart', JSON.stringify(cartItems));
  }, [cartItems, cartLoaded]);
  // ────────────────────────────────────────────────────────

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const showQuickActions = messages.length === 1;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleAddToCart = (product) => {
    setCartItems((current) => {
      const existing = current.find((item) => item.part_number === product.part_number);
      if (existing) {
        return current.map((item) => (
          item.part_number === product.part_number
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ));
      }
      return [...current, { ...product, quantity: 1 }];
    });
  };

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
        body: JSON.stringify({ messages: apiMessages, modelNumber }),
      });

      if (!res.ok) {
        throw new Error(`API returned ${res.status}`);
      }

      const data = await res.json();
      if (data.detectedModel && !modelNumber) setModelNumber(data.detectedModel);
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
    <div className="chat-layout">
      <aside className="assistant-panel" aria-label="Assistant capabilities">
        <div className="panel-eyebrow">Scoped commerce agent</div>
        <h1>Find the right OEM part before you buy.</h1>
        <p>
          Built for refrigerator and dishwasher shoppers: diagnose symptoms, verify model fit,
          review install steps, and move recommended parts into a cart flow.
        </p>
        <div className="capability-list">
          <span>Catalog search</span>
          <span>Model compatibility</span>
          <span>Repair guidance</span>
          <span>Order support</span>
        </div>
          {modelNumber && (
            <div className="model-indicator">
              <span className="model-indicator-label">Your model</span>
              <div className="model-indicator-row">
                <span className="model-indicator-number">{modelNumber}</span>
                <button className="model-clear-btn" onClick={() => setModelNumber(null)} title="Clear model">×</button>
              </div>
            </div>
          )}

        <CartSummary items={cartItems} />
      </aside>

      <section className="chat-wrapper" aria-label="PartSelect chat">
        <div className="messages-container">
          {messages.map((message, index) => (
            <MessageBubble key={index} message={message} onAddToCart={handleAddToCart} />
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
      </section>
    </div>
  );
}
