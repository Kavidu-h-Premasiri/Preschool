import React, { useState, useEffect } from 'react';
import '../css/TeacherDirectory.css';
import UserNavbar from '../components/UserNavbar';

const TeacherDirectory = () => {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterClass, setFilterClass] = useState('');

  // Fetch teachers from API
  useEffect(() => {
    fetchTeachers();
  }, [filterStatus, filterClass]);

  const fetchTeachers = async () => {
    setLoading(true);
    try {
      let queryParams = [];
      if (filterStatus) queryParams.push(`status=${filterStatus}`);
      if (filterClass) queryParams.push(`class=${filterClass}`);
      const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';

      const response = await fetch(`http://localhost:3002/teachers${queryString}`);
      const data = await response.json();
      
      if (response.ok) {
        setTeachers(Array.isArray(data) ? data : []);
      } else {
        setError('Failed to fetch teachers');
      }
    } catch (err) {
      console.error('Error fetching teachers:', err);
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const getProfilePhotoUrl = (teacher) => {
    if (teacher.profilePhoto && teacher.profilePhoto.data && teacher.profilePhoto.contentType) {
      return `data:${teacher.profilePhoto.contentType};base64,${teacher.profilePhoto.data}`;
    }
    return null;
  };

  const getStatusBadgeClass = (status) => {
    switch(status) {
      case 'Active': return 'status-active';
      case 'On Leave': return 'status-leave';
      case 'Resigned': return 'status-resigned';
      case 'Terminated': return 'status-terminated';
      case 'Probation': return 'status-probation';
      default: return '';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const filteredTeachers = teachers.filter(teacher => {
    const matchesSearch = teacher.teacherName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         teacher.teacherId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         teacher.email?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  // Status options for filter
  const statusOptions = ['Active', 'On Leave', 'Probation', 'Resigned', 'Terminated'];
  const classOptions = ['LKG', 'UKG', 'Nursery', 'Daycare'];

  // Handle back to list view
  const handleBackToList = () => {
    setSelectedTeacher(null);
  };

  // If a teacher is selected, show detailed view
  if (selectedTeacher) {
    const photoUrl = getProfilePhotoUrl(selectedTeacher);
    
    return (
      <div className="teacher-directory-wrapper">
        <UserNavbar />
        <div className="teacher-directory">
          <div className="detail-view-container">
            <button className="back-button" onClick={handleBackToList}>
              <span className="back-icon">←</span> Back to Directory
            </button>
            
            <div className="teacher-detail-card">
              <div className="detail-header">
                <div className="detail-photo-section">
                  {photoUrl ? (
                    <img 
                      src={photoUrl} 
                      alt={selectedTeacher.teacherName}
                      className="detail-photo"
                    />
                  ) : (
                    <div className="detail-photo-placeholder">
                      <span className="placeholder-icon">👩‍🏫</span>
                    </div>
                  )}
                </div>
                <div className="detail-title-section">
                  <h1 className="detail-name">{selectedTeacher.teacherName}</h1>
                  <div className="detail-meta">
                    <span className={`detail-status-badge ${getStatusBadgeClass(selectedTeacher.status)}`}>
                      {selectedTeacher.status}
                    </span>
                    <span className="detail-id">ID: {selectedTeacher.teacherId}</span>
                  </div>
                </div>
              </div>

              <div className="detail-content">
                {/* Personal Information */}
                <div className="detail-section">
                  <h3 className="section-title">
                    <span className="section-icon">👤</span> Personal Information
                  </h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <label>Email</label>
                      <p>{selectedTeacher.email}</p>
                    </div>
                    <div className="info-item">
                      <label>Phone</label>
                      <p>{selectedTeacher.phoneNumber}</p>
                    </div>
                    {selectedTeacher.alternatePhone && (
                      <div className="info-item">
                        <label>Alternate Phone</label>
                        <p>{selectedTeacher.alternatePhone}</p>
                      </div>
                    )}
                    <div className="info-item">
                      <label>Date of Birth</label>
                      <p>{formatDate(selectedTeacher.dateOfBirth)}</p>
                    </div>
                    <div className="info-item">
                      <label>Gender</label>
                      <p>{selectedTeacher.gender}</p>
                    </div>
                    <div className="info-item full-width">
                      <label>Address</label>
                      <p>
                        {selectedTeacher.address?.street}, {selectedTeacher.address?.city},<br />
                        {selectedTeacher.address?.state} - {selectedTeacher.address?.postalCode}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Professional Information */}
                <div className="detail-section">
                  <h3 className="section-title">
                    <span className="section-icon">📚</span> Professional Information
                  </h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <label>Qualification</label>
                      <p>{selectedTeacher.qualification}</p>
                    </div>
                    <div className="info-item">
                      <label>Specialization</label>
                      <p>{selectedTeacher.specialization}</p>
                    </div>
                    <div className="info-item">
                      <label>Experience</label>
                      <p>{selectedTeacher.experience} years</p>
                    </div>
                    <div className="info-item">
                      <label>Previous School</label>
                      <p>{selectedTeacher.previousSchool || 'N/A'}</p>
                    </div>
                    <div className="info-item">
                      <label>Employment Type</label>
                      <p>{selectedTeacher.employmentType}</p>
                    </div>
                    <div className="info-item">
                      <label>Joining Date</label>
                      <p>{formatDate(selectedTeacher.joiningDate)}</p>
                    </div>
                  </div>
                </div>

                {/* Assigned Classes */}
                <div className="detail-section">
                  <h3 className="section-title">
                    <span className="section-icon">🏫</span> Assigned Classes
                  </h3>
                  <div className="classes-container">
                    {selectedTeacher.assignedClasses && selectedTeacher.assignedClasses.length > 0 ? (
                      selectedTeacher.assignedClasses.map((cls, idx) => (
                        <div key={idx} className="class-card-detail">
                          <span className="class-name">{cls.className}</span>
                          {cls.section && <span className="class-section">Section {cls.section}</span>}
                          {cls.isClassTeacher && (
                            <span className="class-teacher-badge-detail">Class Teacher 👑</span>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="no-data-text">No classes assigned</p>
                    )}
                  </div>
                </div>

                {/* Skills & Languages */}
                <div className="detail-section">
                  <h3 className="section-title">
                    <span className="section-icon">⭐</span> Skills & Languages
                  </h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <label>Skills</label>
                      <div className="tags-container">
                        {selectedTeacher.skills && selectedTeacher.skills.length > 0 ? (
                          selectedTeacher.skills.map((skill, idx) => (
                            <span key={idx} className="skill-tag">{skill}</span>
                          ))
                        ) : (
                          <p>No skills listed</p>
                        )}
                      </div>
                    </div>
                    <div className="info-item">
                      <label>Languages</label>
                      <div className="tags-container">
                        {selectedTeacher.languages && selectedTeacher.languages.length > 0 ? (
                          selectedTeacher.languages.map((lang, idx) => (
                            <span key={idx} className="language-tag">{lang}</span>
                          ))
                        ) : (
                          <p>No languages listed</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Emergency Contact */}
                {selectedTeacher.emergencyContact && (
                  <div className="detail-section">
                    <h3 className="section-title">
                      <span className="section-icon">🚨</span> Emergency Contact
                    </h3>
                    <div className="info-grid">
                      <div className="info-item">
                        <label>Name</label>
                        <p>{selectedTeacher.emergencyContact.name}</p>
                      </div>
                      <div className="info-item">
                        <label>Relationship</label>
                        <p>{selectedTeacher.emergencyContact.relationship}</p>
                      </div>
                      <div className="info-item">
                        <label>Phone</label>
                        <p>{selectedTeacher.emergencyContact.phone}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main listing view
  return (
    <div className="teacher-directory-wrapper">
      <UserNavbar />
      <div className="teacher-directory">
        <div className="directory-container">
          {/* Header */}
          <div className="directory-header">
            <div className="header-left">
              <div className="header-icon">👩‍🏫</div>
              <div>
                <h1 className="directory-title">Teacher Directory</h1>
                <p className="directory-subtitle">Meet our dedicated preschool educators</p>
              </div>
            </div>
            <div className="stats-badge">
              <span className="stats-number">{filteredTeachers.length}</span>
              <span className="stats-label">Teachers</span>
            </div>
          </div>

          {/* Filters */}
          <div className="filters-section">
            <div className="search-box">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search by name, ID or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
            <div className="filter-group">
              <select 
                value={filterStatus} 
                onChange={(e) => setFilterStatus(e.target.value)}
                className="filter-select"
              >
                <option value="">All Status</option>
                {statusOptions.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <select 
                value={filterClass} 
                onChange={(e) => setFilterClass(e.target.value)}
                className="filter-select"
              >
                <option value="">All Classes</option>
                {classOptions.map(cls => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Loading teachers...</p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="error-container">
              <span className="error-icon">⚠️</span>
              <p>{error}</p>
              <button className="retry-btn" onClick={fetchTeachers}>Retry</button>
            </div>
          )}

          {/* Teacher Cards Grid */}
          {!loading && !error && (
            <div className="teachers-grid">
              {filteredTeachers.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">👩‍🏫</span>
                  <p>No teachers found</p>
                  <button className="clear-filters-btn" onClick={() => {
                    setSearchTerm('');
                    setFilterStatus('');
                    setFilterClass('');
                  }}>
                    Clear Filters
                  </button>
                </div>
              ) : (
                filteredTeachers.map((teacher) => {
                  const photoUrl = getProfilePhotoUrl(teacher);
                  return (
                    <div 
                      key={teacher.teacherId || teacher._id} 
                      className="teacher-card"
                      onClick={() => setSelectedTeacher(teacher)}
                    >
                      <div className="card-photo">
                        {photoUrl ? (
                          <img src={photoUrl} alt={teacher.teacherName} />
                        ) : (
                          <div className="photo-placeholder">
                            <span>👩‍🏫</span>
                          </div>
                        )}
                        <span className={`card-status ${getStatusBadgeClass(teacher.status)}`}>
                          {teacher.status}
                        </span>
                      </div>
                      <div className="card-info">
                        <h3 className="teacher-name">{teacher.teacherName}</h3>
                        <p className="teacher-id">{teacher.teacherId}</p>
                        <p className="teacher-email">{teacher.email}</p>
                        <div className="card-classes">
                          {teacher.assignedClasses && teacher.assignedClasses.length > 0 ? (
                            teacher.assignedClasses.slice(0, 2).map((cls, idx) => (
                              <span key={idx} className="class-badge">
                                {cls.className}{cls.section ? `-${cls.section}` : ''}
                              </span>
                            ))
                          ) : (
                            <span className="no-class-badge">No Class</span>
                          )}
                          {teacher.assignedClasses && teacher.assignedClasses.length > 2 && (
                            <span className="more-badge">+{teacher.assignedClasses.length - 2}</span>
                          )}
                        </div>
                        <div className="card-footer">
                          <span className="experience-badge">{teacher.experience} years</span>
                          <span className="view-detail">View Profile →</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeacherDirectory;