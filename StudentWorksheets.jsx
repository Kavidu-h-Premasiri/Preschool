/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from "react";
import axios from "axios";
import "../css/StudentWorksheets.css";
import StudentNavbar from "../components/UserNavbar"; // Import student navbar

const StudentWorksheets = () => {
  const [worksheets, setWorksheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterClass, setFilterClass] = useState("all");
  const [selectedWorksheet, setSelectedWorksheet] = useState(null);
  const [studentInfo, setStudentInfo] = useState(null);

  // Get student info from localStorage or props
  useEffect(() => {
    // Get student info from localStorage (set during login)
    const storedStudent = localStorage.getItem("studentInfo");
    if (storedStudent) {
      setStudentInfo(JSON.parse(storedStudent));
    }
    fetchWorksheets();
  }, []);

  const fetchWorksheets = async () => {
    try {
      setLoading(true);
      const response = await axios.get("http://localhost:3002/worksheets");
      setWorksheets(response.data);
      setError("");
    } catch (err) {
      console.error("Error fetching worksheets:", err);
      setError("Failed to load worksheets. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (worksheet) => {
    try {
      setSuccess(`Downloading ${worksheet.title}...`);
      const response = await axios.get(`http://localhost:3002/worksheets/${worksheet.worksheetId}/download`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', worksheet.fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      setSuccess(`Downloaded ${worksheet.title} successfully!`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Download error:", err);
      setError("Failed to download worksheet. Please try again.");
      setTimeout(() => setError(""), 3000);
    }
  };

  const handlePreview = (worksheet) => {
    setSelectedWorksheet(worksheet);
  };

  const closePreview = () => {
    setSelectedWorksheet(null);
  };

  const getFileIcon = (fileType) => {
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('image')) return '🖼️';
    if (fileType.includes('word')) return '📝';
    return '📎';
  };

  const getCategoryIcon = (category) => {
    const icons = {
      academic: '📚',
      creative: '🎨',
      practice: '✏️'
    };
    return icons[category] || '📚';
  };

  const getCategoryColor = (category) => {
    const colors = {
      academic: '#4CAF50',
      creative: '#FF9800',
      practice: '#2196F3'
    };
    return colors[category] || '#4CAF50';
  };

  const filteredWorksheets = worksheets.filter(worksheet => {
    const matchesSearch = worksheet.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          worksheet.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          worksheet.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (worksheet.tags && worksheet.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())));
    
    const matchesCategory = filterCategory === "all" || worksheet.category === filterCategory;
    const matchesClass = filterClass === "all" || worksheet.className === filterClass;
    
    return matchesSearch && matchesCategory && matchesClass;
  });

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="student-worksheets-wrapper">
      {/* Student Navigation Bar */}
      <StudentNavbar />
      
      <div className="student-worksheets-container">
        {/* Animated Background */}
        <div className="student-animated-bg">
          <div className="student-cloud student-cloud-1">☁️</div>
          <div className="student-cloud student-cloud-2">☁️</div>
          <div className="student-cloud student-cloud-3">☁️</div>
          <div className="student-sun">🌞</div>
          <div className="student-tree student-tree-1">🌳</div>
          <div className="student-tree student-tree-2">🌲</div>
          <div className="student-flower student-flower-1">🌻</div>
          <div className="student-flower student-flower-2">🌸</div>
          <div className="student-butterfly student-butterfly-1">🦋</div>
          <div className="student-butterfly student-butterfly-2">🦋</div>
        </div>

        <div className="student-worksheets-content">
          {/* Header Section */}
          <div className="student-header-section">
            <div className="student-header-icon">
              <span className="student-header-emoji">📚</span>
              <span className="student-header-emoji">🌟</span>
              <span className="student-header-emoji">✏️</span>
            </div>
            <h1>My Learning Worksheets</h1>
            <p className="student-header-subtitle">
              {studentInfo ? `Welcome, ${studentInfo.childName}!` : "Welcome to your learning journey!"}
              <br />Explore and download fun worksheets
            </p>
            <div className="student-decorative-line"></div>
          </div>

          {/* Welcome Banner for Student */}
          {studentInfo && (
            <div className="student-welcome-banner">
              <div className="student-welcome-icon">🎓</div>
              <div className="student-welcome-text">
                <h3>Hello, {studentInfo.childName}!</h3>
                <p>Class: {studentInfo.className || 'Not Assigned'} | ID: {studentInfo.childId}</p>
              </div>
            </div>
          )}

          {/* Filters Section */}
          <div className="student-filters-section">
            <div className="student-search-box">
              <input
                type="text"
                placeholder="🔍 Search worksheets by title, subject, or tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="student-filter-group">
              <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)}>
                <option value="all">📚 All Classes</option>
                <option value="LKG">🌈 LKG</option>
                <option value="UKG">⭐ UKG</option>
              </select>

              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                <option value="all">🎯 All Categories</option>
                <option value="academic">📚 Academic</option>
                <option value="creative">🎨 Creative</option>
                <option value="practice">✏️ Practice</option>
              </select>
            </div>
          </div>

          {/* Messages */}
          {error && (
            <div className="student-error-message">
              <span>⚠️</span> {error}
              <button onClick={() => setError("")}>×</button>
            </div>
          )}

          {success && (
            <div className="student-success-message">
              <span>✓</span> {success}
              <button onClick={() => setSuccess("")}>×</button>
            </div>
          )}

          {/* Worksheets Grid */}
          {loading ? (
            <div className="student-loading-spinner">
              <div className="student-spinner"></div>
              <p>Loading fun worksheets for you...</p>
            </div>
          ) : filteredWorksheets.length === 0 ? (
            <div className="student-empty-state">
              <div className="student-empty-icon">📚</div>
              <h3>No Worksheets Found</h3>
              <p>Check back later for new learning materials!</p>
            </div>
          ) : (
            <>
              <div className="student-worksheets-count">
                <span>📖 {filteredWorksheets.length} worksheets available</span>
              </div>
              <div className="student-worksheets-grid">
                {filteredWorksheets.map((worksheet, index) => (
                  <div key={worksheet.worksheetId} className="student-worksheet-card" style={{ animationDelay: `${index * 0.05}s` }}>
                    <div className="student-worksheet-header" style={{ borderBottomColor: getCategoryColor(worksheet.category) }}>
                      <div className="student-worksheet-icon">
                        {getFileIcon(worksheet.fileType)}
                      </div>
                      <div className="student-worksheet-badges">
                        <span className={`student-class-badge ${worksheet.className.toLowerCase()}`}>
                          {worksheet.className}
                        </span>
                        <span className="student-category-badge" style={{ background: getCategoryColor(worksheet.category) }}>
                          {getCategoryIcon(worksheet.category)} {worksheet.category}
                        </span>
                      </div>
                    </div>
                    
                    <div className="student-worksheet-body">
                      <h3 className="student-worksheet-title">{worksheet.title}</h3>
                      <p className="student-worksheet-subject">📖 {worksheet.subject}</p>
                      {worksheet.description && (
                        <p className="student-worksheet-description">{worksheet.description}</p>
                      )}
                      {worksheet.tags && worksheet.tags.length > 0 && (
                        <div className="student-worksheet-tags">
                          {worksheet.tags.slice(0, 3).map((tag, idx) => (
                            <span key={idx} className="student-tag">#{tag}</span>
                          ))}
                          {worksheet.tags.length > 3 && (
                            <span className="student-tag-more">+{worksheet.tags.length - 3}</span>
                          )}
                        </div>
                      )}
                      <div className="student-worksheet-meta">
                        <span>📅 Added: {formatDate(worksheet.uploadedAt)}</span>
                        <span>⬇️ {worksheet.downloadCount || 0} downloads</span>
                      </div>
                    </div>
                    
                    <div className="student-worksheet-actions">
                      <button className="student-btn-download" onClick={() => handleDownload(worksheet)}>
                        ⬇️ Download
                      </button>
                      <button className="student-btn-preview" onClick={() => handlePreview(worksheet)}>
                        👁️ Preview
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Fun Fact Section */}
          <div className="student-fun-fact">
            <div className="student-fun-fact-icon">💡</div>
            <div className="student-fun-fact-text">
              <strong>Did you know?</strong> Learning with worksheets helps improve memory and makes studying fun!
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {selectedWorksheet && (
        <div className="student-modal-overlay" onClick={closePreview}>
          <div className="student-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="student-modal-header">
              <h3>{selectedWorksheet.title}</h3>
              <button className="student-modal-close" onClick={closePreview}>×</button>
            </div>
            <div className="student-modal-body">
              <div className="student-modal-info">
                <p><strong>Subject:</strong> {selectedWorksheet.subject}</p>
                <p><strong>Class:</strong> {selectedWorksheet.className}</p>
                <p><strong>Category:</strong> {selectedWorksheet.category}</p>
                <p><strong>File Name:</strong> {selectedWorksheet.fileName}</p>
                <p><strong>Added:</strong> {formatDate(selectedWorksheet.uploadedAt)}</p>
                {selectedWorksheet.description && (
                  <p><strong>Description:</strong> {selectedWorksheet.description}</p>
                )}
                {selectedWorksheet.tags && selectedWorksheet.tags.length > 0 && (
                  <p><strong>Tags:</strong> {selectedWorksheet.tags.map(tag => `#${tag}`).join(', ')}</p>
                )}
              </div>
              <div className="student-modal-preview">
                <div className="student-preview-icon">
                  {getFileIcon(selectedWorksheet.fileType)}
                </div>
                <p className="student-preview-text">
                  {selectedWorksheet.fileType.includes('pdf') ? '📄 PDF Document' :
                   selectedWorksheet.fileType.includes('image') ? '🖼️ Image File' :
                   selectedWorksheet.fileType.includes('word') ? '📝 Word Document' :
                   '📎 Document'}
                </p>
                <button className="student-btn-download-large" onClick={() => {
                  handleDownload(selectedWorksheet);
                  closePreview();
                }}>
                  ⬇️ Download Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentWorksheets;