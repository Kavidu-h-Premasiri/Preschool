import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../css/Message.css';
import NavigationBar from '../components/AdminNavbar';

const AdminMessage = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // all, general, feedback, suggestion, complaint
  const [replyTo, setReplyTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [showReplyForm, setShowReplyForm] = useState(false);

  // Get admin info from localStorage
  const adminId = localStorage.getItem('adminId') || 'ADMIN001';
  const isAdmin = localStorage.getItem('isAdmin') === 'true' || adminId === 'ADMIN001';

  // Fetch messages on component mount
  useEffect(() => {
    fetchMessages();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchMessages, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchMessages = async () => {
    try {
      const response = await axios.get('http://localhost:3002/messages');
      setMessages(response.data);
      setError('');
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async (messageId) => {
    if (!replyText.trim()) {
      setError('Please enter a reply message');
      return;
    }

    try {
      const response = await axios.post(`http://localhost:3002/messages/${messageId}/reply`, {
        reply: replyText,
        repliedBy: adminId
      });

      if (response.data.success) {
        setSuccess('Reply sent successfully!');
        setReplyTo(null);
        setReplyText('');
        setShowReplyForm(false);
        await fetchMessages();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      console.error('Error sending reply:', err);
      setError('Failed to send reply');
    }
  };

  const handleUpdateStatus = async (messageId, status) => {
    try {
      const response = await axios.patch(`http://localhost:3002/messages/${messageId}/status`, {
        status
      });

      if (response.data.success) {
        setSuccess(`Message marked as ${status}`);
        await fetchMessages();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      console.error('Error updating status:', err);
      setError('Failed to update status');
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (window.confirm('Are you sure you want to delete this message?')) {
      try {
        const response = await axios.delete(`http://localhost:3002/messages/${messageId}`);
        if (response.data.success) {
          setSuccess('Message deleted successfully');
          await fetchMessages();
          setTimeout(() => setSuccess(''), 3000);
        }
      } catch (err) {
        console.error('Error deleting message:', err);
        setError('Failed to delete message');
      }
    }
  };

  const getMessageTypeIcon = (type) => {
    switch(type) {
      case 'general': return '💬';
      case 'feedback': return '⭐';
      case 'suggestion': return '💡';
      case 'complaint': return '⚠️';
      default: return '📝';
    }
  };

  const getMessageTypeClass = (type) => {
    switch(type) {
      case 'general': return 'type-general';
      case 'feedback': return 'type-feedback';
      case 'suggestion': return 'type-suggestion';
      case 'complaint': return 'type-complaint';
      default: return '';
    }
  };

  const renderStars = (rating) => {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  };

  const filteredMessages = messages.filter(message => {
    if (activeFilter === 'all') return true;
    return message.messageType === activeFilter;
  });

  return (
    <div className="admin-message-wrapper">
      <NavigationBar />
      <div className="message-container">
        {/* Nature Background */}
        <div className="nature-bg-message">
          <div className="leaf leaf-1">🌿</div>
          <div className="leaf leaf-2">🍃</div>
          <div className="leaf leaf-3">🌱</div>
          <div className="leaf leaf-4">🌿</div>
          <div className="leaf leaf-5">🍂</div>
          <div className="leaf leaf-6">🍃</div>
          <div className="flower flower-1">🌸</div>
          <div className="flower flower-2">🌻</div>
        </div>

        <div className="floating-circle circle-1"></div>
        <div className="floating-circle circle-2"></div>
        <div className="floating-circle circle-3"></div>

        <div className="message-content">
          {/* Header Section */}
          <div className="header-section">
            <div className="header-icon">
              <span className="header-emoji">💬</span>
            </div>
            <h1>Preschool Message Center</h1>
            <p className="header-subtitle">Manage and respond to messages from parents and visitors</p>
            <div className="info-banner">
              <span>📢 Admin Dashboard - View and manage all messages</span>
            </div>
          </div>

          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span> {error}
            </div>
          )}

          {success && (
            <div className="success-message">
              <span className="success-icon">✓</span> {success}
            </div>
          )}

          {/* Messages Display Section - Only visible to admin */}
          {isAdmin && (
            <div className="messages-section">
              <div className="messages-header">
                <h2>
                  <span className="section-icon">📬</span>
                  Messages ({messages.length})
                </h2>
                
                <div className="filter-buttons">
                  <button
                    className={`filter-btn ${activeFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setActiveFilter('all')}
                  >
                    All
                  </button>
                  <button
                    className={`filter-btn ${activeFilter === 'general' ? 'active' : ''}`}
                    onClick={() => setActiveFilter('general')}
                  >
                    💬 General
                  </button>
                  <button
                    className={`filter-btn ${activeFilter === 'feedback' ? 'active' : ''}`}
                    onClick={() => setActiveFilter('feedback')}
                  >
                    ⭐ Feedback
                  </button>
                  <button
                    className={`filter-btn ${activeFilter === 'suggestion' ? 'active' : ''}`}
                    onClick={() => setActiveFilter('suggestion')}
                  >
                    💡 Suggestion
                  </button>
                  <button
                    className={`filter-btn ${activeFilter === 'complaint' ? 'active' : ''}`}
                    onClick={() => setActiveFilter('complaint')}
                  >
                    ⚠️ Complaint
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="loading-spinner">Loading messages...</div>
              ) : filteredMessages.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📭</div>
                  <h3>No Messages Found</h3>
                  <p>Messages will appear here once users send them</p>
                </div>
              ) : (
                <div className="messages-list">
                  {filteredMessages.map((message) => (
                    <div key={message._id} className={`message-card ${message.status}`}>
                      <div className="message-header">
                        <div className="message-info">
                          <div className="message-sender">
                            <span className="sender-icon">👤</span>
                            <strong>{message.name}</strong>
                            {message.isAnonymous && (
                              <span className="anonymous-badge">Anonymous</span>
                            )}
                          </div>
                          <div className="message-date">
                            {new Date(message.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <div className="message-badges">
                          <span className={`message-type ${getMessageTypeClass(message.messageType)}`}>
                            {getMessageTypeIcon(message.messageType)} {message.messageType}
                          </span>
                        </div>
                      </div>

                      <div className="message-subject">
                        <h3>{message.subject}</h3>
                      </div>

                      <div className="message-body">
                        <p>{message.message}</p>
                      </div>

                      {message.rating && (
                        <div className="message-rating">
                          <span>Rating: </span>
                          <span className="stars">{renderStars(message.rating)}</span>
                        </div>
                      )}

                      {message.email && (
                        <div className="message-email">
                          <span>📧 {message.email}</span>
                        </div>
                      )}

                      {message.reply && (
                        <div className="message-reply">
                          <div className="reply-header">
                            <span className="reply-icon">💬</span>
                            <strong>Admin Response:</strong>
                          </div>
                          <p>{message.reply}</p>
                          <small>Replied on: {new Date(message.repliedAt).toLocaleString()}</small>
                        </div>
                      )}

                      <div className="message-actions">
                        {message.status !== 'replied' && (
                          <>
                            {!showReplyForm || replyTo !== message._id ? (
                              <button
                                className="action-btn reply"
                                onClick={() => {
                                  setReplyTo(message._id);
                                  setShowReplyForm(true);
                                  setReplyText('');
                                }}
                              >
                                💬 Reply
                              </button>
                            ) : (
                              <div className="reply-form">
                                <textarea
                                  placeholder="Type your reply here..."
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                  rows="3"
                                ></textarea>
                                <div className="reply-actions">
                                  <button
                                    className="send-reply-btn"
                                    onClick={() => handleReply(message._id)}
                                  >
                                    Send Reply
                                  </button>
                                  <button
                                    className="cancel-reply-btn"
                                    onClick={() => {
                                      setReplyTo(null);
                                      setShowReplyForm(false);
                                      setReplyText('');
                                    }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                        
                        <button
                          className="action-btn mark-reviewed"
                          onClick={() => handleUpdateStatus(message._id, 'reviewed')}
                          disabled={message.status === 'reviewed' || message.status === 'resolved' || message.status === 'replied'}
                        >
                          ✓ Mark Reviewed
                        </button>
                        
                        <button
                          className="action-btn resolve"
                          onClick={() => handleUpdateStatus(message._id, 'resolved')}
                          disabled={message.status === 'resolved' || message.status === 'replied'}
                        >
                          ✅ Resolve
                        </button>
                        
                        <button
                          className="action-btn delete"
                          onClick={() => handleDeleteMessage(message._id)}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminMessage;