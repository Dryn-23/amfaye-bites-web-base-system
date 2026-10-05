import { useState, useEffect, useRef } from "react";
import { X, Send } from "lucide-react";

// Mini pastry-bot: a croissant-shaped body with a robot face.
function PastryBotIcon({ size = 24 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      {/* antenna */}
      <line x1="32" y1="6" x2="32" y2="16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="32" cy="7" r="3" fill="#FFD166" stroke="currentColor" strokeWidth="1.5" />
      {/* croissant body */}
      <path
        d="M32 16c-6 0-10 4-12 8-1.6 3.2-4 8-2 13 1.4 3.5 4 6 7 7.5 4.4 2.2 9 3.5 14 3.5s9.6-1.3 14-3.5c3-1.5 5.6-4 7-7.5 2-5-.4-9.8-2-13-2-4-6-8-12-8z"
        fill="#E9B872"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* eyes */}
      <circle cx="26" cy="32" r="3.2" fill="#2F241A" />
      <circle cx="38" cy="32" r="3.2" fill="#2F241A" />
      <circle cx="27.2" cy="30.8" r="1" fill="white" />
      <circle cx="39.2" cy="30.8" r="1" fill="white" />
      {/* smile */}
      <path
        d="M27 39c2 2 8 2 10 0"
        stroke="#2F241A"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

const FAQ_RESPONSES = {
  hours: {
    keywords: ["hours", "open", "time", "schedule", "when"],
    response: "We're open Monday to Sunday, 8:00 AM - 8:00 PM. Ready to serve you fresh pastries and shakes! 🕐",
  },
  delivery: {
    keywords: ["delivery", "deliver", "shipping", "ship"],
    response: "Yes! We offer delivery through Foodpanda and Grab. Delivery fee is ₱50. You can track your order in real-time! 🚚",
  },
  payment: {
    keywords: ["payment", "pay", "cash", "gcash", "card"],
    response: "We accept Cash at pickup and Demo GCash for online orders. Payment is secure and easy! 💳",
  },
  order: {
    keywords: ["order", "track", "status"],
    response: "Track your order anytime in 'My Orders'. You'll get notifications when it's ready for pickup or out for delivery! 📦",
  },
  cancel: {
    keywords: ["cancel", "refund", "return"],
    response: "You can cancel orders that are Pending or Confirmed. For paid orders, please contact us for assistance. ❌",
  },
  menu: {
    keywords: ["menu", "products", "items", "pastries", "shakes"],
    response: "Check out our delicious pastries and fresh fruit shakes in the Menu section! All customizable to your taste. 🥐🥤",
  },
  promo: {
    keywords: ["promo", "discount", "coupon", "deal", "sale"],
    response: "We have regular promotions! Use code SWEET10 for 10% off. Check our Promotions page for current deals! 🎉",
  },
  customization: {
    keywords: ["custom", "size", "sugar", "ice", "addon"],
    response: "Our shakes are fully customizable! Choose your size (S/M/L), sugar level (0-100%), ice amount, and add-ons. 🧊",
  },
};

export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [clicked, setClicked] = useState(false);
  const [messages, setMessages] = useState([
    {
      type: "bot",
      text: "Hi! I'm your Amfaye Bites assistant. How can I help you today? 😊",
      time: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage = {
      type: "user",
      text: input,
      time: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    // Simple keyword matching
    setTimeout(() => {
      const lowerInput = input.toLowerCase();
      let response = null;

      for (const [key, faq] of Object.entries(FAQ_RESPONSES)) {
        if (faq.keywords.some((keyword) => lowerInput.includes(keyword))) {
          response = faq.response;
          break;
        }
      }

      if (!response) {
        response =
          "I'm not sure about that. Would you like to chat with our support team? Click the Messages icon in the navbar! 💬";
      }

      const botMessage = {
        type: "bot",
        text: response,
        time: new Date(),
      };

      setMessages((prev) => [...prev, botMessage]);
    }, 500);
  };

  const quickQuestions = [
    "What are your hours?",
    "Do you deliver?",
    "How can I track my order?",
    "What payment methods do you accept?",
  ];

  return (
    <>
      {/* Chat Button */}
      {!isOpen && (
        <button
          className={`chatbot-button${clicked ? " clicked" : ""}`}
          onClick={() => {
            setClicked(true);
            setIsOpen(true);
          }}
          aria-label="Open chatbot"
        >
          <PastryBotIcon size={34} />
          <span className="chatbot-badge">?</span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="chatbot-window">
          <div className="chatbot-header">
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div className="chatbot-avatar">
                <PastryBotIcon size={26} />
              </div>
              <div>
                <div style={{ fontWeight: "600" }}>Amfaye Bot</div>
                <div style={{ fontSize: "0.75rem", opacity: 0.8 }}>
                  Online • Usually replies instantly
                </div>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="chatbot-close">
              <X size={20} />
            </button>
          </div>

          <div className="chatbot-messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={`chat-message ${msg.type}`}>
                {msg.type === "bot" && (
                  <div className="message-avatar">
                    <PastryBotIcon size={20} />
                  </div>
                )}
                <div className="message-bubble">
                  <p>{msg.text}</p>
                  <span className="message-time">
                    {msg.time.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {messages.length === 1 && (
            <div className="quick-questions">
              <div style={{ fontSize: "0.85rem", marginBottom: "0.5rem", opacity: 0.7 }}>
                Quick questions:
              </div>
              {quickQuestions.map((q, idx) => (
                <button
                  key={idx}
                  className="quick-question-btn"
                  onClick={() => setInput(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <div className="chatbot-input">
            <input
              type="text"
              placeholder="Type your question..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSend()}
            />
            <button onClick={handleSend} disabled={!input.trim()}>
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
