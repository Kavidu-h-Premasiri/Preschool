// QRCodeGenerator.jsx
import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import QRCode from "qrcode";
import "../css/QRCodeGenerator.css";
import AdminNavbar from '../components/AdminNavbar';

const QRCodeGenerator = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [generatedQRCodes, setGeneratedQRCodes] = useState([]);
  const [qrSize, setQrSize] = useState(250);
  const [includeName, setIncludeName] = useState(true);
  const [selectedStudentDetails, setSelectedStudentDetails] = useState(null);
  
  const qrRef = useRef(null);

  // Fetch students from backend
  const fetchStudents = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await axios.get('http://localhost:3002/students');
      console.log("Full API Response:", response.data);
      
      if (response.data.success) {
        // Standardize data fields to match what the component expects
        const rawStudents = response.data.students || [];
        const studentsData = rawStudents.map(student => ({
          ...student,
          childId: student.childId || student._id || student.id,
          childName: student.childName || student.fullName || student.name || "Unknown",
          className: student.className || student.class || student.mainClass || "Not Assigned"
        }));
        
        console.log("Students data received:", studentsData);
        console.log("Number of students:", studentsData.length);
        
        if (studentsData && studentsData.length > 0) {
          console.log("First student sample:", studentsData[0]);
        }
        
        setStudents(studentsData);
      } else {
        setError(response.data.message || "Failed to fetch students");
        console.error("API returned success=false:", response.data);
      }
    } catch (err) {
      console.error("Error fetching students:", err);
      setError("Could not connect to server. Please check if the backend is running on port 3002.");
    } finally {
      setLoading(false);
    }
  };

  // Load students on component mount
  useEffect(() => {
    fetchStudents();
  }, []);

  // Generate QR Code for a single student
  const generateQRCode = async (student) => {
    if (!student) {
      setError("No student selected");
      return;
    }
    
    setGenerating(true);
    setError("");
    
    try {
      const studentId = student.childId;
      const studentName = student.childName;
      
      if (!studentId) {
        throw new Error("Student ID is missing");
      }
      
      let qrData;
      if (includeName) {
        qrData = `${studentId}|${studentName}`;
      } else {
        qrData = studentId;
      }
      
      console.log("Generating QR for:", studentName, "with data:", qrData);
      
      const qrDataUrl = await QRCode.toDataURL(qrData, {
        width: qrSize,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'H'
      });
      
      setQrCodeUrl(qrDataUrl);
      setSelectedStudent(student);
      setSuccess(`QR Code generated for ${studentName}`);
      setTimeout(() => setSuccess(""), 3000);
      
      return qrDataUrl;
    } catch (err) {
      console.error("Error generating QR code:", err);
      setError("Failed to generate QR code: " + err.message);
      setTimeout(() => setError(""), 3000);
      return null;
    } finally {
      setGenerating(false);
    }
  };

  // Generate QR codes for multiple students
  const generateBulkQRCodes = async () => {
    if (selectedStudents.length === 0) {
      setError("Please select at least one student");
      return;
    }
    
    setGenerating(true);
    setError("");
    
    const qrCodes = [];
    
    for (const studentId of selectedStudents) {
      const student = students.find(s => s.childId === studentId);
      if (student) {
        try {
          const qrData = includeName ? `${student.childId}|${student.childName}` : student.childId;
          const qrDataUrl = await QRCode.toDataURL(qrData, {
            width: qrSize,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#ffffff'
            },
            errorCorrectionLevel: 'H'
          });
          
          qrCodes.push({
            studentId: student.childId,
            studentName: student.childName,
            qrCode: qrDataUrl
          });
        } catch (err) {
          console.error(`Error generating QR for ${student.childId}:`, err);
        }
      }
    }
    
    setGeneratedQRCodes(qrCodes);
    setSuccess(`Generated ${qrCodes.length} QR codes successfully!`);
    setTimeout(() => setSuccess(""), 3000);
    setGenerating(false);
  };

  // Download single QR code as PNG
  const downloadQRCode = () => {
    if (!qrCodeUrl || !selectedStudent) return;
    
    const link = document.createElement('a');
    link.download = `${selectedStudent.childId}_${selectedStudent.childName}_qr.png`;
    link.href = qrCodeUrl;
    link.click();
    
    setSuccess("QR Code downloaded!");
    setTimeout(() => setSuccess(""), 3000);
  };

  // Download all bulk QR codes as a zip
  const downloadAllQRCodes = async () => {
    if (generatedQRCodes.length === 0) return;
    
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      
      generatedQRCodes.forEach(qr => {
        const base64Data = qr.qrCode.split(',')[1];
        zip.file(`${qr.studentId}_${qr.studentName}_qr.png`, base64Data, { base64: true });
      });
      
      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement('a');
      link.download = `qr_codes_${new Date().toISOString().split('T')[0]}.zip`;
      link.href = URL.createObjectURL(content);
      link.click();
      URL.revokeObjectURL(link.href);
      
      setSuccess("All QR codes downloaded as ZIP!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Error creating zip:", err);
      setError("Failed to create zip file");
    }
  };

  // Print QR code
  const printQRCode = () => {
    if (!qrCodeUrl || !selectedStudent) return;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>QR Code - ${selectedStudent.childName}</title>
          <style>
            body {
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
            }
            .qr-container {
              text-align: center;
            }
            img {
              max-width: 300px;
              height: auto;
            }
            h2 {
              margin-top: 20px;
              color: #333;
            }
            p {
              color: #666;
              margin: 5px 0;
            }
          </style>
        </head>
        <body>
          <div class="qr-container">
            <img src="${qrCodeUrl}" alt="QR Code" />
            <h2>${selectedStudent.childName}</h2>
            <p>ID: ${selectedStudent.childId}</p>
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // Handle student selection for bulk generation
  const toggleStudentSelection = (studentId) => {
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  // Select/Deselect all students
  const selectAllStudents = () => {
    if (selectedStudents.length === filteredStudents.length && filteredStudents.length > 0) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(filteredStudents.map(s => s.childId));
    }
  };

  // Filter students based on search (added safety fallbacks)
  const filteredStudents = students.filter(student =>
    (student.childId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (student.childName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // View student details
  const viewStudentDetails = (student) => {
    setSelectedStudentDetails(student);
  };

  // Close student details modal
  const closeDetailsModal = () => {
    setSelectedStudentDetails(null);
  };

  return (
    <>
      <AdminNavbar />
      <div className="qr-generator-page">
        <div className="qr-generator-wrapper">
          <div className="qr-generator-container">
            <div className="nature-bg">
              <div className="leaf leaf-1">🌿</div>
              <div className="leaf leaf-2">🍃</div>
              <div className="leaf leaf-3">🌱</div>
            </div>
            <div className="floating-circle circle-1"></div>
            <div className="floating-circle circle-2"></div>

            <div className="generator-content">
              <div className="header-section">
                <div className="header-icon">
                  <span className="header-emoji">🎫</span>
                </div>
                <h1>QR Code Generator</h1>
                <p className="header-subtitle">
                  Generate QR codes for students to use with the attendance scanner
                </p>
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

              <div className="generator-layout">
                {/* Left Panel - Student List */}
                <div className="students-panel">
                  <div className="panel-header">
                    <h2>📚 Students List ({filteredStudents.length})</h2>
                    <div className="panel-actions">
                      <button
                        className={`mode-toggle ${!bulkMode ? 'active' : ''}`}
                        onClick={() => setBulkMode(false)}
                      >
                        Single
                      </button>
                      <button
                        className={`mode-toggle ${bulkMode ? 'active' : ''}`}
                        onClick={() => setBulkMode(true)}
                      >
                        Bulk
                      </button>
                    </div>
                  </div>

                  <div className="search-bar">
                    <input
                      type="text"
                      placeholder="🔍 Search by ID or Name..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="search-input"
                    />
                  </div>

                  {bulkMode && filteredStudents.length > 0 && (
                    <div className="bulk-actions">
                      <label className="select-all-label">
                        <input
                          type="checkbox"
                          checked={selectedStudents.length === filteredStudents.length && filteredStudents.length > 0}
                          onChange={selectAllStudents}
                        />
                        Select All ({filteredStudents.length})
                      </label>
                      <button
                        className="generate-bulk-btn"
                        onClick={generateBulkQRCodes}
                        disabled={generating || selectedStudents.length === 0}
                      >
                        {generating ? '⏳ Generating...' : `🎫 Generate ${selectedStudents.length} QR Codes`}
                      </button>
                    </div>
                  )}

                  <div className="students-list">
                    {loading ? (
                      <div className="empty-students">
                        <span className="empty-icon">⏳</span>
                        <p>Loading students...</p>
                      </div>
                    ) : filteredStudents.length === 0 ? (
                      <div className="empty-students">
                        <span className="empty-icon">👥</span>
                        <p>{students.length === 0 ? "No students found in the system" : "No matching students found"}</p>
                      </div>
                    ) : (
                      filteredStudents.map(student => (
                        <div
                          key={student.childId}
                          className={`student-card ${selectedStudent?.childId === student.childId && !bulkMode ? 'active' : ''} ${selectedStudents.includes(student.childId) && bulkMode ? 'selected' : ''}`}
                          style={{
                            display: 'flex',
                            flexDirection: 'row', // Force horizontal layout
                            alignItems: 'center',
                            justifyContent: 'flex-start', // Align to left
                            padding: '12px 16px',
                            marginBottom: '12px',
                            backgroundColor: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '10px',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            gap: '12px',
                            height: 'auto',          
                            minHeight: '85px',       
                            width: '100%',
                            boxSizing: 'border-box', 
                            position: 'relative',
                            overflow: 'hidden', // Prevent breaking
                            flexWrap: 'nowrap'
                          }}
                        >
                          {bulkMode && (
                            <input
                              type="checkbox"
                              className="student-checkbox"
                              checked={selectedStudents.includes(student.childId)}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleStudentSelection(student.childId);
                              }}
                              style={{ width: '18px', height: '18px', cursor: 'pointer', flexShrink: 0, margin: 0 }}
                            />
                          )}
                          <div 
                            className="student-avatar" 
                            onClick={() => !bulkMode && viewStudentDetails(student)}
                            style={{
                              width: '45px',
                              height: '45px',
                              borderRadius: '50%',
                              backgroundColor: '#f1f5f9',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '24px',
                              flexShrink: 0,
                              margin: 0, // Reset any external margin
                              overflow: 'hidden'
                            }}
                          >
                            {student.profilePhoto && student.profilePhoto.startsWith('data:image') ? (
                              <img 
                                src={student.profilePhoto} 
                                alt={student.childName} 
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                              />
                            ) : (
                              <span className="avatar-emoji">
                                {student.gender === 'Female' ? '👧' : '👦'}
                              </span>
                            )}
                          </div>
                          <div 
                            className="student-info" 
                            onClick={() => !bulkMode && viewStudentDetails(student)}
                            style={{ 
                              flexGrow: 1, 
                              display: 'flex', 
                              flexDirection: 'column', 
                              justifyContent: 'center',
                              alignItems: 'flex-start',
                              gap: '4px',
                              overflow: 'hidden',
                              textAlign: 'left', // Force left align
                              margin: 0
                            }}
                          >
                            <h4 className="student-name" style={{ margin: 0, fontSize: '16px', color: '#1e293b', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                              {student.childName || "No Name"}
                            </h4>
                            <p className="student-id-text" style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                              <span className="id-label">🆔</span> {student.childId || "No ID"}
                            </p>
                            <p className="student-class-text" style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                              <span className="class-label">📚</span> {student.className || 'Not Assigned'}
                            </p>
                          </div>
                          {!bulkMode && (
                            <div className="student-actions" style={{ 
                                display: 'flex', 
                                flexDirection: 'row', 
                                alignItems: 'center',
                                gap: '8px', 
                                flexShrink: 0, 
                                position: 'static', // Override external absolute positioning
                                margin: 0 
                              }}>
                              <button 
                                className="view-details-btn" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  viewStudentDetails(student);
                                }}
                                title="View Details"
                                style={{
                                  padding: '8px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  backgroundColor: '#f8fafc',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  height: '36px'
                                }}
                              >
                                👁️
                              </button>
                              <button 
                                className="generate-qr-btn-small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  generateQRCode(student);
                                }}
                                title="Generate QR Code"
                                style={{
                                  padding: '8px 12px',
                                  borderRadius: '6px',
                                  border: 'none',
                                  backgroundColor: '#3b82f6',
                                  color: 'white',
                                  fontWeight: '500',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  fontSize: '13px',
                                  height: '36px'
                                }}
                              >
                                🎫 Generate
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Right Panel - QR Code Display */}
                <div className="qr-panel">
                  <div className="panel-header">
                    <h2>🔲 QR Code</h2>
                    <div className="qr-settings">
                      <label className="setting-label">
                        Size:
                        <select value={qrSize} onChange={(e) => setQrSize(Number(e.target.value))}>
                          <option value="150">Small (150px)</option>
                          <option value="200">Medium (200px)</option>
                          <option value="250">Large (250px)</option>
                          <option value="300">Extra Large (300px)</option>
                        </select>
                      </label>
                      <label className="setting-label checkbox">
                        <input
                          type="checkbox"
                          checked={includeName}
                          onChange={(e) => setIncludeName(e.target.checked)}
                        />
                        Include Name in QR
                      </label>
                    </div>
                  </div>

                  <div className="qr-display">
                    {generating ? (
                      <div className="qr-loading">
                        <div className="loading-spinner"></div>
                        <p>Generating QR Code...</p>
                      </div>
                    ) : qrCodeUrl && selectedStudent ? (
                      <>
                        <div className="qr-image-container">
                          <img
                            ref={qrRef}
                            src={qrCodeUrl}
                            alt="QR Code"
                            className="qr-image"
                            style={{ width: qrSize, height: qrSize }}
                          />
                          <div className="qr-overlay">
                            <span className="qr-scan-icon">📱</span>
                          </div>
                        </div>
                        <div className="qr-student-info">
                          <h3>{selectedStudent.childName}</h3>
                          <p>ID: {selectedStudent.childId}</p>
                          <p className="qr-data-preview">
                            Data: {includeName ? `${selectedStudent.childId}|${selectedStudent.childName}` : selectedStudent.childId}
                          </p>
                        </div>
                        <div className="qr-actions">
                          <button className="download-btn" onClick={downloadQRCode}>
                            💾 Download PNG
                          </button>
                          <button className="print-btn" onClick={printQRCode}>
                            🖨️ Print
                          </button>
                        </div>
                      </>
                    ) : bulkMode && generatedQRCodes.length > 0 ? (
                      <div className="bulk-results">
                        <div className="bulk-header">
                          <h3>Generated QR Codes ({generatedQRCodes.length})</h3>
                          <button className="download-all-btn" onClick={downloadAllQRCodes}>
                            📦 Download All as ZIP
                          </button>
                        </div>
                        <div className="bulk-qr-grid">
                          {generatedQRCodes.map(qr => (
                            <div key={qr.studentId} className="bulk-qr-item">
                              <img
                                src={qr.qrCode}
                                alt={`QR for ${qr.studentName}`}
                                className="bulk-qr-image"
                                style={{ width: 120, height: 120 }}
                              />
                              <p className="bulk-qr-name">{qr.studentName}</p>
                              <p className="bulk-qr-id">{qr.studentId}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="qr-placeholder">
                        <div className="placeholder-icon">🎫</div>
                        <h3>No QR Code Generated</h3>
                        <p>Click on a student from the list to generate their QR code</p>
                        <div className="placeholder-instructions">
                          <div className="instruction">
                            <span className="instruction-num">1</span>
                            <span>Select a student from the left panel</span>
                          </div>
                          <div className="instruction">
                            <span className="instruction-num">2</span>
                            <span>QR code will be generated automatically</span>
                          </div>
                          <div className="instruction">
                            <span className="instruction-num">3</span>
                            <span>Download or print for student use</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Info Section */}
                  <div className="qr-info-section">
                    <h4>📌 How to use:</h4>
                    <ul>
                      <li>Generated QR codes contain student ID and name</li>
                      <li>Use the QR Scanner page to scan and record attendance</li>
                      <li>Each QR code can be printed and given to students</li>
                      <li>Scanner automatically detects duplicate scans within 5 minutes</li>
                      <li>Bulk mode allows generating multiple QR codes at once</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Student Details Modal */}
        {selectedStudentDetails && (
          <div className="modal-overlay" onClick={closeDetailsModal}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Student Details</h2>
                <button className="modal-close" onClick={closeDetailsModal}>✕</button>
              </div>
              <div className="modal-body">
                <div 
                  className="detail-avatar" 
                  style={{ textAlign: 'center', marginBottom: '20px' }}
                >
                  {selectedStudentDetails.profilePhoto && selectedStudentDetails.profilePhoto.startsWith('data:image') ? (
                    <img 
                      src={selectedStudentDetails.profilePhoto} 
                      alt={selectedStudentDetails.childName} 
                      style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', margin: '0 auto' }} 
                    />
                  ) : (
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', margin: '0 auto' }}>
                      <span className="detail-emoji">{selectedStudentDetails.gender === 'Female' ? '👧' : '👦'}</span>
                    </div>
                  )}
                </div>
                <div className="detail-info">
                  <div className="detail-row">
                    <span className="detail-label">Full Name:</span>
                    <span className="detail-value">{selectedStudentDetails.childName || "Not Available"}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Student ID:</span>
                    <span className="detail-value">{selectedStudentDetails.childId || "Not Available"}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Registered Date:</span>
                    <span className="detail-value">{selectedStudentDetails.registeredDate ? new Date(selectedStudentDetails.registeredDate).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  className="generate-qr-btn"
                  onClick={() => {
                    generateQRCode(selectedStudentDetails);
                    closeDetailsModal();
                  }}
                >
                  🎫 Generate QR Code
                </button>
                <button className="close-modal-btn" onClick={closeDetailsModal}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default QRCodeGenerator;