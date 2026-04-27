import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../css/Message.css';
import UserNavbar from '../components/UserNavbar';

const Message = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // all, general, feedback, suggestion, complaint


  // Form state for new message
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    messageType: 'general',
    subject: '',
    message: '',
    rating: 5,
    isAnonymous: false
  });

  // Form validation errors
  const [formErrors, setFormErrors] = useState({});

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

  const validateForm = () => {
    const errors = {};

    if (!formData.name.trim() && !formData.isAnonymous) {
      errors.name = 'Name is required';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) && !formData.isAnonymous) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.subject.trim()) {
      errors.subject = 'Subject is required';
    }

    if (!formData.message.trim()) {
      errors.message = 'Message is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    // Handle anonymous checkbox change
    if (name === 'isAnonymous') {
      setFormData({
        ...formData,
        isAnonymous: checked,
        // Clear name and email when anonymous is checked
        name: checked ? '' : formData.name,
        email: checked ? '' : formData.email
      });
      
      // Clear errors for name and email when anonymous is checked
      if (checked) {
        setFormErrors({
          ...formErrors,
          name: null,
          email: null
        });
      }
    } 
    // Handle message type change - reset rating if not feedback
    else if (name === 'messageType') {
      setFormData({
        ...formData,
        messageType: value,
        // Reset rating to default if not feedback
        rating: value === 'feedback' ? formData.rating : 5
      });
    }
    else {
      setFormData({
        ...formData,
        [name]: type === 'checkbox' ? checked : value
      });
    }
    
    // Clear error for this field
    if (formErrors[name]) {
      setFormErrors({
        ...formErrors,
        [name]: null
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      // Only include rating if message type is feedback
      const submitData = {
        ...formData,
        name: formData.isAnonymous ? 'Anonymous' : formData.name,
        email: formData.isAnonymous ? '' : formData.email,
        ipAddress: 'visitor'
      };

      // If message type is not feedback, remove rating from submission
      if (formData.messageType !== 'feedback') {
        delete submitData.rating;
      }

      const response = await axios.post('http://localhost:3002/messages', submitData);

      if (response.data.success) {
        setSuccess('Thank you for your message! We appreciate your feedback.');
        // Reset form
        setFormData({
          name: '',
          email: '',
          messageType: 'general',
          subject: '',
          message: '',
          rating: 5,
          isAnonymous: false
        });
        setFormErrors({});
        // Refresh messages
        await fetchMessages();
        setTimeout(() => setSuccess(''), 5000);
      }
    } catch (err) {
      console.error('Error submitting message:', err);
      setError(err.response?.data?.error || 'Failed to submit message. Please try again.');
    } finally {
      setSubmitting(false);
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
    <div className="message-page-wrapper">
      <UserNavbar />
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
            <p className="header-subtitle">Share your thoughts, feedback, and suggestions with us</p>
            <div className="info-banner">
              <span>📢 Your voice matters! We value every message and will respond within 24 hours.</span>
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

          {/* Message Form Section */}
          <div className="form-section">
            <div className="form-card">
              <h2>
                <span className="section-icon">✍️</span>
                Send Us a Message
              </h2>
              
              <form onSubmit={handleSubmit} className="message-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Your Name {formData.isAnonymous && <span className="optional-badge">(Hidden when anonymous)</span>}</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      disabled={formData.isAnonymous}
                      placeholder={formData.isAnonymous ? "Name will be hidden" : "Enter your name"}
                      className={formErrors.name ? 'error' : ''}
                    />
                    {formErrors.name && (
                      <small className="error-text">{formErrors.name}</small>
                    )}
                    {formData.isAnonymous && (
                      <small className="info-text">Your name will not be shown publicly</small>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Email (Optional) {formData.isAnonymous && <span className="optional-badge">(Hidden when anonymous)</span>}</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      disabled={formData.isAnonymous}
                      placeholder={formData.isAnonymous ? "Email will be hidden" : "your@email.com"}
                      className={formErrors.email ? 'error' : ''}
                    />
                    {formErrors.email && (
                      <small className="error-text">{formErrors.email}</small>
                    )}
                    {formData.isAnonymous && (
                      <small className="info-text">Your email will not be shared</small>
                    )}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Message Type</label>
                    <select
                      name="messageType"
                      value={formData.messageType}
                      onChange={handleInputChange}
                    >
                      <option value="general">💬 General Message</option>
                      <option value="feedback">⭐ Feedback</option>
                      <option value="suggestion">💡 Suggestion</option>
                      <option value="complaint">⚠️ Complaint</option>
                    </select>
                  </div>

                  {/* Rating section - only shown when message type is feedback */}
                  {formData.messageType === 'feedback' && (
                    <div className="form-group">
                      <label>Rating (1-5)</label>
                      <div className="rating-input">
                        {[1, 2, 3, 4, 5].map(star => (
                          <button
                            key={star}
                            type="button"
                            className={`star-btn ${formData.rating >= star ? 'active' : ''}`}
                            onClick={() => setFormData({...formData, rating: star})}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                      <small className="info-text">How would you rate your experience?</small>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>Subject</label>
                  <input
                    type="text"
                    name="subject"
                    value={formData.subject}
                    onChange={handleInputChange}
                    placeholder="Brief subject of your message"
                    className={formErrors.subject ? 'error' : ''}
                  />
                  {formErrors.subject && (
                    <small className="error-text">{formErrors.subject}</small>
                  )}
                </div>

                <div className="form-group">
                  <label>Your Message</label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    rows="5"
                    placeholder="Please share your thoughts, feedback, or suggestions..."
                    className={formErrors.message ? 'error' : ''}
                  ></textarea>
                  {formErrors.message && (
                    <small className="error-text">{formErrors.message}</small>
                  )}
                </div>

                <div className="form-group checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="isAnonymous"
                      checked={formData.isAnonymous}
                      onChange={handleInputChange}
                    />
                    Submit anonymously (name and email will be hidden)
                  </label>
                </div>

                <button
                  type="submit"
                  className="submit-btn"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <span className="spinner-small"></span>
                      Sending...
                    </>
                  ) : (
                    <>
                      <span className="btn-icon">📤</span>
                      Send Message
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

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

                      {/* Only show rating if message type is feedback and rating exists */}
                      {message.messageType === 'feedback' && message.rating && (
                        <div className="message-rating">
                          <span>Rating: </span>
                          <span className="stars">{renderStars(message.rating)}</span>
                        </div>
                      )}

                      {message.email && !message.isAnonymous && (
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

export default Message;