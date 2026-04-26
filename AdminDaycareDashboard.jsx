import React, { useState, useEffect } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import '../css/AdminDaycareDashboard.css';
import AdminNavbar from '../components/AdminNavbar';
import '../css/AdminDaycareDashboardnavbar.css'

const AdminDaycareDashboard = () => {
  const [students, setStudents] = useState([]);
  const [presentToday, setPresentToday] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    setLoading(true);
    setError('');
    try {
      // Fetch all eligible students AND today's attendance simultaneously
      const [eligibleRes, todayRes] = await Promise.all([
        axios.get('http://localhost:3002/daycare/eligible'),
        axios.get('http://localhost:3002/daycare/today')
      ]);
      
      console.log('Eligible students response:', eligibleRes.data);
      console.log('Today attendance response:', todayRes.data);
      console.log('Eligible response type:', Array.isArray(eligibleRes.data));
      console.log('Today response type:', Array.isArray(todayRes.data));
      
      // Handle the response - your backend returns arrays directly
      let eligibleStudents = [];
      let todayAttendance = [];
      
      // Check if eligibleRes.data is an array
      if (Array.isArray(eligibleRes.data)) {
        eligibleStudents = eligibleRes.data;
      } else if (eligibleRes.data && eligibleRes.data.data && Array.isArray(eligibleRes.data.data)) {
        eligibleStudents = eligibleRes.data.data;
      } else if (eligibleRes.data && eligibleRes.data.students && Array.isArray(eligibleRes.data.students)) {
        eligibleStudents = eligibleRes.data.students;
      } else {
        console.warn('Unexpected eligible students format:', eligibleRes.data);
        eligibleStudents = [];
      }
      
      // Check if todayRes.data is an array
      if (Array.isArray(todayRes.data)) {
        todayAttendance = todayRes.data;
      } else if (todayRes.data && todayRes.data.data && Array.isArray(todayRes.data.data)) {
        todayAttendance = todayRes.data.data;
      } else if (todayRes.data && todayRes.data.attendance && Array.isArray(todayRes.data.attendance)) {
        todayAttendance = todayRes.data.attendance;
      } else {
        console.warn('Unexpected today attendance format:', todayRes.data);
        todayAttendance = [];
      }
      
      setStudents(eligibleStudents);
      
      // Map today's list to an array of childIds
      const presentIds = todayAttendance.map(entry => {
        // Handle different possible field names
        return entry.childId || entry.child_id || entry._id || entry.id;
      }).filter(id => id); // Remove undefined/null values
      
      console.log('Present IDs:', presentIds);
      setPresentToday(presentIds);
      
    } catch (err) {
      console.error("Failed to load admin data", err);
      setError(`Failed to load daycare data: ${err.message || 'Please check your connection.'}`);
      // Set empty arrays to prevent further errors
      setStudents([]);
      setPresentToday([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter students based on search term
  const filteredStudents = students.filter(student => {
    if (!student) return false;
    const fullName = student.fullName || student.full_name || student.name || '';
    const childId = student.childId || student.child_id || student.id || '';
    return fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           childId.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Sort students: present first, then not present
  const sortedStudents = [...filteredStudents].sort((a, b) => {
    const aId = a.childId || a.child_id || a.id;
    const bId = b.childId || b.child_id || b.id;
    const aIsPresent = presentToday.includes(aId);
    const bIsPresent = presentToday.includes(bId);
    
    // Present children come first
    if (aIsPresent && !bIsPresent) return -1;
    if (!aIsPresent && bIsPresent) return 1;
    
    // If both present or both not present, sort by name alphabetically
    const aName = a.fullName || a.full_name || a.name || '';
    const bName = b.fullName || b.full_name || b.name || '';
    return aName.localeCompare(bName);
  });

  // Group students for display
  const presentStudents = sortedStudents.filter(student => {
    const studentId = student.childId || student.child_id || student.id;
    return presentToday.includes(studentId);
  });
  
  const notPresentStudents = sortedStudents.filter(student => {
    const studentId = student.childId || student.child_id || student.id;
    return !presentToday.includes(studentId);
  });

  // Helper function to get student name
  const getStudentName = (student) => {
    return student.fullName || student.full_name || student.name || 'Unknown';
  };

  // Helper function to get student ID
  const getStudentId = (student) => {
    return student.childId || student.child_id || student.id || 'N/A';
  };

  // Helper function to get student class
  const getStudentClass = (student) => {
    return student.class || student.class_name || student.mainClass || 'Not Assigned';
  };

  // Helper function to get student gender
  const getStudentGender = (student) => {
    return student.gender || student.gender || 'Other';
  };

  // Helper function to get profile photo
  const getProfilePhoto = (student) => {
    return student.profilePhoto || student.photo || null;
  };

  // Helper function to get facility
  const getFacility = (student) => {
    return getStudentClass(student) === 'Daycare' ? 'Primary' : 'Extended';
  };

  // Function to download PDF
  const downloadPDF = () => {
    // Use presentStudents which only includes eligible students that are present
    if (presentStudents.length === 0) {
      alert('No students present today to generate PDF.');
      return;
    }

    const doc = new jsPDF('landscape');
    
    // Add title
    doc.setFontSize(18);
    doc.setTextColor(46, 125, 50);
    doc.text('Daycare Attendance Report', 14, 15);
    
    // Add date
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    const todayDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    doc.text(`Date: ${todayDate}`, 14, 25);
    doc.text(`Total Present: ${presentStudents.length} / 5`, 14, 32);
    
    // Prepare table data
    const tableData = presentStudents.map(student => [
      getStudentId(student),
      getStudentName(student),
      getStudentClass(student),
      getFacility(student)
    ]);
    
    // Generate table
    autoTable(doc, {
      startY: 40,
      head: [['Student ID', 'Student Name', 'Main Class', 'Facility']],
      body: tableData,
      headStyles: {
        fillColor: [76, 175, 80],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center'
      },
      styles: {
        fontSize: 10,
        cellPadding: 5,
        halign: 'center',
        valign: 'middle'
      },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 70 },
        2: { cellWidth: 60 },
        3: { cellWidth: 50 }
      },
      alternateRowStyles: {
        fillColor: [240, 248, 240]
      }
    });
    
    // Add footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Generated on ${new Date().toLocaleString()} - Daycare Management System`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }
    
    // Save the PDF
    doc.save(`daycare_attendance_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  if (loading) {
    return (
      <div className="admin-daycare-wrapper">
        <AdminNavbar />
        <div className="admin-dashboard-container">
          <div className="nature-bg">
            <div className="leaf leaf-1">🌿</div>
            <div className="leaf leaf-2">🍃</div>
            <div className="leaf leaf-3">🌱</div>
            <div className="leaf leaf-4">🌿</div>
            <div className="leaf leaf-5">🍂</div>
            <div className="leaf leaf-6">🍃</div>
          </div>
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <div className="loading-text">Loading daycare data...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-daycare-wrapper">
      <AdminNavbar />
      <div className="admin-dashboard-container">
        <div className="nature-bg">
          <div className="leaf leaf-1">🌿</div>
          <div className="leaf leaf-2">🍃</div>
          <div className="leaf leaf-3">🌱</div>
          <div className="leaf leaf-4">🌿</div>
          <div className="leaf leaf-5">🍂</div>
          <div className="leaf leaf-6">🍃</div>
        </div>

        <div className="floating-circle circle-1"></div>
        <div className="floating-circle circle-2"></div>
        <div className="floating-circle circle-3"></div>

        <div className="dashboard-content">
          {/* Header & Stats Section */}
          <div className="dashboard-header">
            <div className="header-title">
              <div className="header-icon">👑</div>
              <div>
                <h1>Admin Daycare Overview</h1>
                <p className="header-subtitle">Manage and view all registered daycare students</p>
              </div>
            </div>
            
            <div className="stats-container">
              <div className="stat-card">
                <h3 className="stat-number">{students.length}</h3>
                <span className="stat-label">Total Eligible</span>
              </div>
              <div className={`stat-card ${presentStudents.length >= 5 ? 'full' : ''}`}>
                <h3 className="stat-number">{presentStudents.length} / 5</h3>
                <span className="stat-label">Present Today</span>
              </div>
              {/* Download PDF Button */}
              <div className="stat-card download-card">
                <button 
                  className="download-pdf-btn"
                  onClick={downloadPDF}
                  disabled={presentStudents.length === 0}
                >
                  <span>📄</span>
                  Download PDF Report
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span> 
              <span>{error}</span>
              <button 
                className="retry-btn"
                onClick={fetchAdminData}
                style={{ 
                  marginLeft: 'auto', 
                  background: 'none', 
                  border: 'none', 
                  cursor: 'pointer',
                  fontSize: '18px',
                  padding: '5px 10px',
                  borderRadius: '8px'
                }}
              >
                🔄 Retry
              </button>
            </div>
          )}

          {/* Search Bar */}
          <div className="search-container">
            <input 
              type="text" 
              placeholder="🔍 Search students by name or ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          {/* Present Students Section */}
          {presentStudents.length > 0 && (
            <div className="section-container">
              <div className="section-header">
                <div className="section-title">
                  <span className="section-icon">✅</span>
                  <h2>Present Today</h2>
                  <span className="section-count">{presentStudents.length}</span>
                </div>
              </div>
              <div className="students-grid">
                {presentStudents.map((student, index) => (
                  <div 
                    key={getStudentId(student)} 
                    className="student-card present"
                    style={{ '--index': index }}
                  >
                    {/* Status Badge */}
                    <div className="status-badge present">
                      <span className="status-dot present"></span>
                      Present Today
                    </div>

                    {/* Profile Photo - Round */}
                    <div className="student-avatar">
                      {getProfilePhoto(student) ? (
                        <img 
                          src={getProfilePhoto(student)} 
                          alt={getStudentName(student)} 
                          className="avatar-image"
                          style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', margin: '0 auto' }}
                        />
                      ) : (
                        <div className="avatar-placeholder" style={{ width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f0f0', fontSize: '30px', margin: '0 auto' }}>
                          {getStudentGender(student) === 'Male' ? '👦' : '👧'}
                        </div>
                      )}
                    </div>

                    {/* Student Info */}
                    <h3 className="student-name">{getStudentName(student)}</h3>
                    <span className="student-id">ID: {getStudentId(student)}</span>

                    <div className="student-details">
                      <div className="detail-item">
                        <span className="detail-label">Main Class</span>
                        <strong className="detail-value">{getStudentClass(student)}</strong>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Facility</span>
                        <strong className="detail-value">{getFacility(student)}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Not Present Students Section */}
          {notPresentStudents.length > 0 && (
            <div className="section-container">
              <div className="section-header">
                <div className="section-title">
                  <span className="section-icon">⏳</span>
                  <h2>Not Present Today</h2>
                  <span className="section-count">{notPresentStudents.length}</span>
                </div>
              </div>
              <div className="students-grid">
                {notPresentStudents.map((student, index) => (
                  <div 
                    key={getStudentId(student)} 
                    className="student-card"
                    style={{ '--index': index }}
                  >
                    {/* Status Badge */}
                    <div className="status-badge">
                      <span className="status-dot"></span>
                      Not Present
                    </div>

                    {/* Profile Photo - Round */}
                    <div className="student-avatar">
                      {getProfilePhoto(student) ? (
                        <img 
                          src={getProfilePhoto(student)} 
                          alt={getStudentName(student)} 
                          className="avatar-image"
                          style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', margin: '0 auto' }}
                        />
                      ) : (
                        <div className="avatar-placeholder" style={{ width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f0f0', fontSize: '30px', margin: '0 auto' }}>
                          {getStudentGender(student) === 'Male' ? '👦' : '👧'}
                        </div>
                      )}
                    </div>

                    {/* Student Info */}
                    <h3 className="student-name">{getStudentName(student)}</h3>
                    <span className="student-id">ID: {getStudentId(student)}</span>

                    <div className="student-details">
                      <div className="detail-item">
                        <span className="detail-label">Main Class</span>
                        <strong className="detail-value">{getStudentClass(student)}</strong>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Facility</span>
                        <strong className="detail-value">{getFacility(student)}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No Results Found */}
          {sortedStudents.length === 0 && !loading && !error && (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <h2>No students found</h2>
              <p>{searchTerm ? `No students matching "${searchTerm}"` : 'No eligible students found'}</p>
            </div>
          )}

          {/* No Data State */}
          {students.length === 0 && !loading && !error && !searchTerm && (
            <div className="empty-state">
              <div className="empty-icon">👧</div>
              <h2>No daycare students found</h2>
              <p>There are no eligible daycare students registered yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDaycareDashboard;