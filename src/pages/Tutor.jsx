import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { tutorAgent } from '../agents/tutorAgent';
import { motion, AnimatePresence } from 'framer-motion';
import { HiOutlinePaperAirplane, HiOutlineTrash, HiOutlineBookOpen, HiOutlineLightBulb, HiOutlineChevronRight } from 'react-icons/hi';

export default function Tutor() {
  const { state, dispatch } = useApp();
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('chat');
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const chatEndRef = useRef(null);

  const subjects = tutorAgent.getSubjects();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.chatHistory]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    // Add user message
    dispatch({
      type: 'ADD_CHAT_MESSAGE',
      payload: { id: Date.now(), role: 'user', text: message, time: new Date().toISOString() },
    });

    // Get AI response
    const response = tutorAgent.getChatResponse(message, state.chatHistory);

    setTimeout(() => {
      dispatch({
        type: 'ADD_CHAT_MESSAGE',
        payload: { id: Date.now() + 1, role: 'assistant', text: response.text, type: response.type, time: new Date().toISOString() },
      });
    }, 400 + Math.random() * 600);

    setMessage('');
  };

  const handleTopicClick = (subject, topic) => {
    setSelectedSubject(subject);
    setSelectedTopic(topic);
    setActiveTab('explore');
  };

  const explanation = selectedSubject && selectedTopic
    ? tutorAgent.getExplanation(selectedSubject, selectedTopic)
    : null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <div className="page-header">
        <h1>🎓 Tutor Agent</h1>
        <p className="subtitle">Learn concepts interactively, ask questions, and explore topics</p>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>
          💬 Chat
        </button>
        <button className={`tab ${activeTab === 'browse' ? 'active' : ''}`} onClick={() => setActiveTab('browse')}>
          📖 Browse Topics
        </button>
        <button className={`tab ${activeTab === 'explore' ? 'active' : ''}`} onClick={() => setActiveTab('explore')}>
          🔍 Explore
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'chat' && (
          <motion.div key="chat" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="chat-container">
              <div className="chat-messages">
                {state.chatHistory.length === 0 && (
                  <div className="chat-welcome">
                    <div className="chat-welcome-icon">🎓</div>
                    <h3>Welcome to the AI Tutor!</h3>
                    <p>Ask me about any topic and I'll explain it clearly. Try these:</p>
                    <div className="chat-suggestions">
                      {['What is Algebra?', 'Explain Data Structures', 'Tell me about Genetics', 'How does Newton\'s 2nd Law work?'].map(s => (
                        <button key={s} className="chip" onClick={() => { setMessage(s); }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {state.chatHistory.map(msg => (
                  <div key={msg.id} className={`chat-message ${msg.role}`}>
                    <div className="chat-avatar">
                      {msg.role === 'user' ? state.user.avatar : '🤖'}
                    </div>
                    <div className="chat-bubble">
                      <div className="chat-text" dangerouslySetInnerHTML={{
                        __html: formatMessage(msg.text)
                      }} />
                      <div className="chat-time">
                        {new Date(msg.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              <form className="chat-input-container" onSubmit={handleSend}>
                <input
                  type="text"
                  className="chat-input"
                  placeholder="Ask me anything about your studies..."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                />
                <button type="submit" className="btn btn-primary btn-icon chat-send" disabled={!message.trim()}>
                  <HiOutlinePaperAirplane />
                </button>
              </form>

              {state.chatHistory.length > 0 && (
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: '8px' }}
                  onClick={() => dispatch({ type: 'CLEAR_CHAT' })}
                >
                  <HiOutlineTrash /> Clear Chat
                </button>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'browse' && (
          <motion.div key="browse" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="grid-auto">
              {subjects.map(subject => {
                const topics = tutorAgent.getTopics(subject);
                const subjectEmojis = {
                  Mathematics: '📐', Science: '🔬', 'Computer Science': '💻',
                  Physics: '⚡', Chemistry: '🧪', Biology: '🧬',
                };
                return (
                  <div key={subject} className="card" style={{ cursor: 'default' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                      <span style={{ fontSize: '1.8rem' }}>{subjectEmojis[subject] || '📖'}</span>
                      <h3 style={{ fontSize: '1.1rem' }}>{subject}</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {topics.map(topic => (
                        <button
                          key={topic}
                          className="topic-button"
                          onClick={() => handleTopicClick(subject, topic)}
                        >
                          <HiOutlineBookOpen style={{ flexShrink: 0, color: 'var(--accent-primary)' }} />
                          <span>{topic}</span>
                          <HiOutlineChevronRight style={{ marginLeft: 'auto', flexShrink: 0, opacity: 0.4 }} />
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {activeTab === 'explore' && (
          <motion.div key="explore" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {!explanation ? (
              <div className="empty-state">
                <div className="emoji">🔍</div>
                <h3>Select a topic to explore</h3>
                <p>Go to "Browse Topics" and click on any topic to see detailed explanations.</p>
              </div>
            ) : (
              <div className="explanation-view">
                <div className="card" style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <span>{selectedSubject}</span>
                    <HiOutlineChevronRight />
                    <span style={{ color: 'var(--accent-primary)' }}>{selectedTopic}</span>
                  </div>
                  <h2 style={{ fontSize: '1.5rem', marginBottom: '16px' }}>{selectedTopic}</h2>
                  <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '0.95rem' }}>
                    {explanation.summary}
                  </p>
                </div>

                <div className="grid-2" style={{ alignItems: 'start' }}>
                  <div className="card">
                    <div className="section-title"><HiOutlineLightBulb className="icon" /> Key Points</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {explanation.keyPoints.map((point, i) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'flex-start', gap: '10px',
                          padding: '12px', background: 'var(--bg-glass)',
                          border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)',
                        }}>
                          <span style={{
                            width: '22px', height: '22px', borderRadius: '50%',
                            background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.7rem', fontWeight: 700, flexShrink: 0, color: 'white',
                          }}>{i + 1}</span>
                          <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{point}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="card">
                    <div className="section-title">📝 Examples</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {explanation.examples.map((ex, i) => (
                        <div key={i} style={{
                          padding: '16px', background: 'var(--bg-glass)',
                          border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)',
                        }}>
                          <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '8px', color: 'var(--accent-secondary)' }}>
                            Q: {ex.problem}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--accent-success)' }}>
                            A: {ex.solution}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .chat-container {
          display: flex;
          flex-direction: column;
        }
        .chat-messages {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg) var(--radius-lg) 0 0;
          padding: 24px;
          min-height: 400px;
          max-height: 500px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .chat-welcome {
          text-align: center;
          padding: 40px 20px;
        }
        .chat-welcome-icon {
          font-size: 3rem;
          margin-bottom: 12px;
          animation: float 4s ease-in-out infinite;
        }
        .chat-welcome h3 {
          font-size: 1.2rem;
          margin-bottom: 8px;
        }
        .chat-welcome p {
          color: var(--text-secondary);
          margin-bottom: 16px;
          font-size: 0.9rem;
        }
        .chat-suggestions {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 8px;
        }
        .chat-suggestions .chip {
          cursor: pointer;
          background: var(--bg-glass);
          border: 1px solid var(--border-color);
          font-family: var(--font-body);
        }
        .chat-suggestions .chip:hover {
          background: var(--bg-glass-hover);
          border-color: var(--accent-primary);
          color: var(--accent-primary);
        }
        .chat-message {
          display: flex;
          gap: 10px;
          max-width: 85%;
          animation: fadeInUp 0.3s ease;
        }
        .chat-message.user {
          flex-direction: row-reverse;
          align-self: flex-end;
        }
        .chat-avatar {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 16px;
          background: var(--bg-glass);
          border: 1px solid var(--border-light);
        }
        .chat-bubble {
          padding: 12px 16px;
          border-radius: var(--radius-md);
          font-size: 0.88rem;
          line-height: 1.6;
        }
        .chat-message.user .chat-bubble {
          background: var(--gradient-primary);
          color: white;
          border-bottom-right-radius: 4px;
        }
        .chat-message.assistant .chat-bubble {
          background: var(--bg-glass);
          border: 1px solid var(--border-light);
          color: var(--text-primary);
          border-bottom-left-radius: 4px;
        }
        .chat-text h2 {
          font-size: 1rem;
          margin-bottom: 8px;
          color: var(--accent-secondary);
        }
        .chat-text h3 {
          font-size: 0.9rem;
          margin: 10px 0 6px;
          color: var(--accent-primary);
        }
        .chat-time {
          font-size: 0.65rem;
          color: var(--text-muted);
          margin-top: 4px;
          opacity: 0.7;
        }
        .chat-message.user .chat-time {
          text-align: right;
          color: rgba(255,255,255,0.6);
        }
        .chat-input-container {
          display: flex;
          gap: 8px;
          padding: 16px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-top: none;
          border-radius: 0 0 var(--radius-lg) var(--radius-lg);
        }
        .chat-input {
          flex: 1;
          padding: 12px 16px;
          background: var(--bg-glass);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-family: var(--font-body);
          font-size: 0.9rem;
          outline: none;
          transition: border-color var(--transition-fast);
        }
        .chat-input:focus {
          border-color: var(--accent-primary);
        }
        .chat-input::placeholder {
          color: var(--text-muted);
        }
        .chat-send {
          width: 46px;
          height: 46px;
          border-radius: var(--radius-md);
          font-size: 1.1rem;
        }

        .topic-button {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          background: var(--bg-glass);
          border: 1px solid var(--border-light);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all var(--transition-normal);
          font-family: var(--font-body);
          font-size: 0.85rem;
          text-align: left;
          width: 100%;
        }
        .topic-button:hover {
          background: var(--bg-glass-hover);
          border-color: var(--accent-primary);
          color: var(--text-primary);
        }
      `}</style>
    </motion.div>
  );
}

function formatMessage(text) {
  return text
    .replace(/## (.*?)$/gm, '<h2>$1</h2>')
    .replace(/### (.*?)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/• (.*?)$/gm, '<div style="display:flex;gap:6px;margin:2px 0"><span>•</span><span>$1</span></div>')
    .replace(/\n/g, '<br/>');
}
