/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from "react";
import axios from "axios";
import "../css/WorksheetUpload.css";
import NavigationBar from "../components/AdminNavbar";

const WorksheetUpload = () => {
  const [worksheets, setWorksheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState("upload");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterClass, setFilterClass] = useState("all");

  const [formData, setFormData] = useState({
    className: "",
    category: "",
    subject: "",
    title: "",
    description: "",
    tags: ""
  });

  const [files, setFiles] = useState([]);

  const categories = [
    { id: "academic", name: "Academic", icon: "📚", description: "Subject-based learning materials", color: "#4CAF50" },
    { id: "creative", name: "Creative", icon: "🎨", description: "Art, drawing, and creative activities", color: "#FF9800" },
    { id: "practice", name: "Practice", icon: "✏️", description: "Worksheets for skill practice", color: "#2196F3" }
  ];

  const getSubjectsByClass = (className) => {
    if (className === "LKG") {
      return [
        "English - Letters",
        "English - Phonics",
        "Mathematics - Numbers",
        "Mathematics - Shapes",
        "Environmental Science",
        "General Awareness",
        "Rhymes & Songs",
        "Art & Craft"
      ];
    } else if (className === "UKG") {
      return [
        "English - Reading",
        "English - Writing",
        "English - Grammar",
        "Mathematics - Addition",
        "Mathematics - Subtraction",
        "Mathematics - Patterns",
        "Environmental Science",
        "General Knowledge",
        "Creative Writing",
        "Art & Craft"
      ];
    }
    return [];
  };

  useEffect(() => {
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
      setError("Failed to load worksheets. Please check if the server is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);
  };

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!formData.className) {
      setError("Please select a class (LKG/UKG)");
      return;
    }

    if (!formData.category) {
      setError("Please select a category");
      return;
    }

    if (!formData.subject) {
      setError("Please enter a subject");
      return;
    }

    if (!formData.title) {
      setError("Please enter a title");
      return;
    }

    if (files.length === 0) {
      setError("Please select at least one file");
      return;
    }

    setUploading(true);
    setError("");
    setSuccess("");

    const formDataToSend = new FormData();
    formDataToSend.append("className", formData.className);
    formDataToSend.append("category", formData.category);
    formDataToSend.append("subject", formData.subject);
    formDataToSend.append("title", formData.title);
    formDataToSend.append("description", formData.description);
    formDataToSend.append("tags", formData.tags);
    
    files.forEach(file => {
      formDataToSend.append("worksheets", file);
    });

    try {
      const response = await axios.post("http://localhost:3002/worksheets/upload", formDataToSend, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });

      if (response.data.success) {
        setSuccess(`Successfully uploaded ${response.data.uploadedCount} worksheet(s)!`);
        setFiles([]);
        setFormData({
          className: "",
          category: "",
          subject: "",
          title: "",
          description: "",
          tags: ""
        });
        const fileInput = document.getElementById('worksheet-files');
        if (fileInput) fileInput.value = '';
        fetchWorksheets();
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError(err.response?.data?.error || "Failed to upload worksheets");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteWorksheet = async (worksheetId) => {
    if (window.confirm("Are you sure you want to delete this worksheet?")) {
      try {
        await axios.delete(`http://localhost:3002/worksheets/${worksheetId}`);
        setSuccess("Worksheet deleted successfully!");
        fetchWorksheets();
        setTimeout(() => setSuccess(""), 3000);
      } catch (err) {
        console.error("Failed to delete worksheet", err);
        setError("Failed to delete worksheet");
      }
    }
  };

  const handleDownload = async (worksheet) => {
    try {
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
      
      setSuccess("Download started!");
      setTimeout(() => setSuccess(""), 2000);
    } catch (err) {
      console.error("Download error:", err);
      setError("Failed to download worksheet");
    }
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

  const getFileIcon = (fileType) => {
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('image')) return '🖼️';
    if (fileType.includes('word')) return '📝';
    return '📎';
  };

  const getCategoryIcon = (category) => {
    const cat = categories.find(c => c.id === category);
    return cat ? cat.icon : '📚';
  };

  return (
    <div className="worksheet-wrapper">
      <NavigationBar />
      <div className="worksheet-container">
        {/* Animated Background Elements */}
        <div className="animated-bg">
          <div className="cloud cloud-1">☁️</div>
          <div className="cloud cloud-2">☁️</div>
          <div className="cloud cloud-3">☁️</div>
          <div className="sun">🌞</div>
          <div className="tree tree-1">🌳</div>
          <div className="tree tree-2">🌲</div>
          <div className="flower flower-1">🌻</div>
          <div className="flower flower-2">🌸</div>
          <div className="flower flower-3">🌼</div>
          <div className="butterfly butterfly-1">🦋</div>
          <div className="butterfly butterfly-2">🦋</div>
          <div className="bunny">🐰</div>
          <div className="bird bird-1">🐦</div>
          <div className="bird bird-2">🕊️</div>
        </div>

        <div className="worksheet-content">
          <div className="header-section">
            <div className="header-icon">
              <span className="header-emoji">🌿</span>
              <span className="header-emoji">📚</span>
              <span className="header-emoji">✏️</span>
            </div>
            <h1>Worksheet Library</h1>
            <p className="header-subtitle">Upload and manage worksheets for LKG & UKG students</p>
            <div className="decorative-line"></div>
          </div>

          {/* Tabs Section - Both tabs always visible */}
          <div className="tabs-section">
            <button
              className={`tab ${activeTab === 'upload' ? 'active' : ''}`}
              onClick={() => setActiveTab('upload')}
            >
              <span className="tab-icon">📤</span>
              <span className="tab-text">Upload Worksheets</span>
            </button>
            <button
              className={`tab ${activeTab === 'library' ? 'active' : ''}`}
              onClick={() => setActiveTab('library')}
            >
              <span className="tab-icon">📚</span>
              <span className="tab-text">Worksheet Library</span>
            </button>
          </div>

          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              <span>{error}</span>
              <button onClick={() => setError("")} className="close-btn">×</button>
            </div>
          )}

          {success && (
            <div className="success-message">
              <span className="success-icon">✓</span>
              <span>{success}</span>
              <button onClick={() => setSuccess("")} className="close-btn">×</button>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="upload-section">
              <div className="form-card">
                <div className="form-header">
                  <h2>Upload New Worksheets</h2>
                  <p>Share learning materials with your students</p>
                </div>
                
                <form onSubmit={handleUpload} className="upload-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label>Select Class *</label>
                      <select
                        name="className"
                        value={formData.className}
                        onChange={handleInputChange}
                        required
                        className="class-select"
                      >
                        <option value="">-- Select Class --</option>
                        <option value="LKG">🏫 LKG (Lower Kindergarten)</option>
                        <option value="UKG">🏫 UKG (Upper Kindergarten)</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Category *</label>
                      <select
                        name="category"
                        value={formData.category}
                        onChange={handleInputChange}
                        required
                        className="category-select"
                      >
                        <option value="">-- Select Category --</option>
                        {categories.map(category => (
                          <option key={category.id} value={category.id}>
                            {category.icon} {category.name} - {category.description}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Subject *</label>
                      <input
                        type="text"
                        name="subject"
                        list="subject-suggestions"
                        value={formData.subject}
                        onChange={handleInputChange}
                        placeholder="Type or select a subject..."
                        required
                        className="subject-input"
                      />
                      <datalist id="subject-suggestions">
                        {getSubjectsByClass(formData.className).map(subject => (
                          <option key={subject} value={subject} />
                        ))}
                      </datalist>
                      
                      {formData.className && getSubjectsByClass(formData.className).length === 0 && (
                        <small className="hint-text">Select a class first to see suggestions</small>
                      )}
                    </div>

                    <div className="form-group">
                      <label>Worksheet Title *</label>
                      <input
                        type="text"
                        name="title"
                        value={formData.title}
                        onChange={handleInputChange}
                        placeholder="e.g., Alphabet Tracing Worksheet"
                        required
                        className="title-input"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Description</label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      placeholder="Describe what this worksheet covers..."
                      rows="3"
                      className="description-input"
                    />
                  </div>

                  <div className="form-group">
                    <label>Tags (Optional, comma separated)</label>
                    <input
                      type="text"
                      name="tags"
                      value={formData.tags}
                      onChange={handleInputChange}
                      placeholder="e.g., alphabet, tracing, beginner"
                      className="tags-input"
                    />
                  </div>

                  <div className="form-group">
                    <label>Upload Files (PDF, Images, Word) *</label>
                    <div className="file-upload-area">
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        multiple
                        onChange={handleFileChange}
                        className="file-input"
                        id="worksheet-files"
                      />
                      <label htmlFor="worksheet-files" className="file-label">
                        <span className="upload-icon">📎</span>
                        <span>Click to select files</span>
                        <small>Supports: PDF, Images (JPG, PNG), Word (DOC, DOCX) | Max 10MB each</small>
                      </label>
                    </div>
                    {files.length > 0 && (
                      <div className="selected-files">
                        <h4>Selected Files: {files.length}</h4>
                        <div className="files-preview-list">
                          {files.map((file, index) => (
                            <div key={index} className="file-preview-item">
                              <span className="file-icon">{getFileIcon(file.type)}</span>
                              <div className="file-info">
                                <span className="file-name">{file.name}</span>
                                <span className="file-size">{(file.size / 1024).toFixed(2)} KB</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <button type="submit" className="upload-button" disabled={uploading}>
                    {uploading ? (
                      <>
                        <span className="spinner-small"></span>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <span className="button-icon">📤</span>
                        Upload Worksheets
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'library' && (
            <div className="library-section">
              <div className="library-header">
                <h2>Worksheet Library</h2>
                <div className="filters-section">
                  <div className="search-box">
                    <input
                      type="text"
                      placeholder="🔍 Search worksheets..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="search-input"
                    />
                  </div>
                  
                  <div className="filter-group">
                    <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)} className="filter-select">
                      <option value="all">All Classes</option>
                      <option value="LKG">LKG</option>
                      <option value="UKG">UKG</option>
                    </select>

                    <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="filter-select">
                      <option value="all">All Categories</option>
                      {categories.map(category => (
                        <option key={category.id} value={category.id}>
                          {category.icon} {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="loading-spinner">
                  <div className="spinner"></div>
                  <p>Loading worksheets...</p>
                </div>
              ) : filteredWorksheets.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📚</div>
                  <h3>No Worksheets Found</h3>
                  <p>Upload worksheets to build your library</p>
                </div>
              ) : (
                <div className="worksheets-grid">
                  {filteredWorksheets.map((worksheet, index) => (
                    <div key={worksheet.worksheetId} className="worksheet-card" style={{ animationDelay: `${index * 0.05}s` }}>
                      <div className="worksheet-header">
                        <div className="worksheet-icon">
                          {getFileIcon(worksheet.fileType)}
                        </div>
                        <div className="worksheet-badges">
                          <span className={`class-badge ${worksheet.className.toLowerCase()}`}>
                            {worksheet.className}
                          </span>
                          <span className={`category-badge ${worksheet.category}`}>
                            {getCategoryIcon(worksheet.category)} {worksheet.category}
                          </span>
                        </div>
                      </div>
                      
                      <div className="worksheet-body">
                        <h3 className="worksheet-title">{worksheet.title}</h3>
                        <p className="worksheet-subject">📖 {worksheet.subject}</p>
                        {worksheet.description && (
                          <p className="worksheet-description">{worksheet.description}</p>
                        )}
                        {worksheet.tags && worksheet.tags.length > 0 && (
                          <div className="worksheet-tags">
                            {worksheet.tags.map((tag, idx) => (
                              <span key={idx} className="tag">#{tag}</span>
                            ))}
                          </div>
                        )}
                        <div className="worksheet-meta">
                          <span>📅 {formatDate(worksheet.uploadedAt)}</span>
                          <span>📄 {worksheet.fileName}</span>
                          <span>⬇️ {worksheet.downloadCount || 0} downloads</span>
                        </div>
                      </div>
                      
                      <div className="worksheet-actions">
                        <button className="action-btn download" onClick={() => handleDownload(worksheet)}>
                          ⬇️ Download
                        </button>
                        <button className="action-btn delete" onClick={() => handleDeleteWorksheet(worksheet.worksheetId)}>
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

export default WorksheetUpload;