import React, { useState, useEffect } from "react";
import axios from "axios";
import "../css/AdminAddChild.css";
import AdminNavbar from "../components/AdminNavbar"; 
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const AdminAddChild = () => {
  const [childId, setChildId] = useState("");
  const [childName, setChildName] = useState("");
  const [children, setChildren] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);

  // --- AUTO-GENERATION LOGIC ---
  const generateNextId = (currentChildren) => {
    if (!currentChildren || currentChildren.length === 0) return "CH0000";

    let maxVal = -1;

    currentChildren.forEach(child => {
      if (child.childId) {
        const id = child.childId.toUpperCase();
        // Match CH + optional single letter + numbers (e.g., CH0001, CHA0005)
        const match = id.match(/^CH([A-Z]?)(\d+)$/);
        
        if (match) {
          const letter = match[1];
          const num = parseInt(match[2], 10);
          
          let val = 0;
          if (letter) {
            // A = 1, B = 2, etc. (Multiplied by 10000 to keep scale higher than max digit 9999)
            val = (letter.charCodeAt(0) - 64) * 10000 + num;
          } else {
            val = num;
          }
          
          if (val > maxVal) maxVal = val;
        }
      }
    });

    const nextVal = maxVal >= 0 ? maxVal + 1 : 0;

    if (nextVal <= 9999) {
      // 0 to 9999 -> CH0000 to CH9999
      return `CH${nextVal.toString().padStart(4, '0')}`;
    } else {
      // 10000+ -> CHA0000, CHB0000, etc.
      const letterVal = Math.floor(nextVal / 10000);
      const numVal = nextVal % 10000;
      const letter = String.fromCharCode(64 + letterVal); // 65 = 'A'
      return `CH${letter}${numVal.toString().padStart(4, '0')}`;
    }
  };

  // LOAD CHILDREN FROM DATABASE
  useEffect(() => {
    fetchChildren();
  }, []);

  const fetchChildren = () => {
    axios.get("http://localhost:3002/children")
      .then(res => {
        setChildren(res.data);
        // Auto-generate ID on initial load
        setChildId(generateNextId(res.data));
      })
      .catch(err => {
        console.log("Fetch error:", err);
        setError("Failed to load children data");
      });
  };

  const isChildIdUnique = (id) => {
    return !children.some(child => child.childId.toLowerCase() === id.toLowerCase());
  };

  const isChildNameUnique = (name) => {
    return !children.some(child => child.childName.toLowerCase() === name.toLowerCase());
  };

  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError("");
        setSuccess("");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  // PDF DOWNLOAD FUNCTION
  const downloadPDF = () => {
    if (children.length === 0) {
      setError("No children data to download");
      return;
    }

    setIsDownloading(true);

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(34, 197, 94);
      doc.text('Children Registration Report', 14, 20);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      const currentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      doc.text(`Generated on: ${currentDate}`, 14, 30);
      doc.text(`Total Children: ${children.length}`, 14, 37);

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(14, 42, 200, 42);

      const tableData = children.map((child) => [
        child.childId || 'N/A',
        child.childName || 'N/A',
        child.registeredDate ? new Date(child.registeredDate).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        }) : 'N/A'
      ]);

      autoTable(doc, {
        startY: 48,
        head: [['Child ID', 'Name', 'Registered Date']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [34, 197, 94],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 11,
          halign: 'center',
          valign: 'middle'
        },
        bodyStyles: {
          fontSize: 10,
          textColor: [30, 41, 59],
          valign: 'middle'
        },
        alternateRowStyles: {
          fillColor: [240, 253, 244]
        },
        columnStyles: {
          0: { cellWidth: 50, halign: 'center' },
          1: { cellWidth: 70, halign: 'left' },
          2: { cellWidth: 50, halign: 'center' }
        },
        margin: { left: 14, right: 14 }
      });

      const pageCount = doc.internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.text(
          `Page ${i} of ${pageCount}`,
          doc.internal.pageSize.getWidth() / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      }

      const finalY = doc.lastAutoTable.finalY + 10;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 116, 139);
      doc.text(`* This report includes all registered children in the system.`, 14, finalY);
      doc.text(`* Total registered children: ${children.length}`, 14, finalY + 6);

      doc.save(`children_report_${new Date().toISOString().split('T')[0]}.pdf`);
      setSuccess("PDF downloaded successfully!");
    } catch (err) {
      console.error("PDF generation error:", err);
      setError("Failed to generate PDF. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    setError("");
    setSuccess("");

    const trimmedId = childId.trim();
    const trimmedName = childName.trim();

    if (!trimmedId) {
      setError("Child ID cannot be empty");
      return;
    }

    if (!trimmedName) {
      setError("Child Name cannot be empty");
      return;
    }

    if (!isChildIdUnique(trimmedId)) {
      setError(`Child ID "${trimmedId}" already exists. Please use a different ID.`);
      return;
    }

    if (!isChildNameUnique(trimmedName)) {
      setError(`Child Name "${trimmedName}" already exists. Please use a different name.`);
      return;
    }

    setIsSubmitting(true);

    const newChild = {
      childId: trimmedId,
      childName: trimmedName
    };

    axios.post("http://localhost:3002/add-child", newChild)
      .then(res => {
        const updatedChildren = [res.data, ...children];
        setChildren(updatedChildren); 
        // Generate the NEXT auto ID
        setChildId(generateNextId(updatedChildren));
        setChildName("");
        setSuccess("Child registered successfully!");
        setIsSubmitting(false);
      })
      .catch(err => {
        console.log("Submit error:", err);
        
        if (err.response && err.response.data && err.response.data.error) {
          setError(err.response.data.error);
        } else {
          setError("Failed to register child. Please try again.");
        }
        
        setIsSubmitting(false);
      });
  };

  const handleDeleteChild = async (deletedChildId, childName) => {
    const confirmDelete = window.confirm(
      `⚠️ WARNING: This will permanently delete "${childName}" (${deletedChildId}) and ALL associated data including:\n\n` +
      `• Student Profile\n• Attendance Records\n• Daycare Records\n• Password Changes\n\n` +
      `This action CANNOT be undone. Are you sure you want to proceed?`
    );
    
    if (!confirmDelete) {
      return;
    }

    setDeletingId(deletedChildId);
    setIsDeleting(true);
    setError("");
    setSuccess("");

    try {
      const response = await axios.delete(`http://localhost:3002/children/${deletedChildId}`);
      
      if (response.data.success) {
        const updatedChildren = children.filter(child => child.childId !== deletedChildId);
        setChildren(updatedChildren);
        // Recalculate auto ID in case the deleted one was the latest
        setChildId(generateNextId(updatedChildren));
        setSuccess(response.data.message || `Child "${childName}" has been deleted successfully!`);
      }
    } catch (err) {
      console.error("Delete error:", err);
      if (err.response && err.response.data && err.response.data.error) {
        setError(err.response.data.error);
      } else {
        setError("Failed to delete child. Please try again.");
      }
    } finally {
      setIsDeleting(false);
      setDeletingId(null);
    }
  };

  const handleBulkDelete = async () => {
    const childIdsToDelete = children.map(child => child.childId);
    
    if (childIdsToDelete.length === 0) {
      setError("No children to delete");
      return;
    }
    
    const confirmBulkDelete = window.confirm(
      `⚠️⚠️⚠️ WARNING: This will delete ALL ${childIdsToDelete.length} children and ALL associated data!\n\n` +
      `This action CANNOT be undone. Are you ABSOLUTELY sure you want to proceed?`
    );
    
    if (!confirmBulkDelete) {
      return;
    }
    
    setIsDeleting(true);
    setError("");
    setSuccess("");
    
    try {
      const response = await axios.post("http://localhost:3002/children/bulk-delete", {
        childIds: childIdsToDelete
      });
      
      if (response.data.success) {
        setChildren([]);
        // Reset auto ID
        setChildId("CH0000");
        setSuccess(response.data.message);
      }
    } catch (err) {
      console.error("Bulk delete error:", err);
      setError("Failed to perform bulk delete. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="admin-add-child-wrapper">
      <AdminNavbar />
      <div className="admin-dashboard" style={{ paddingTop: '80px' }}>
        <div className="nature-bg">
          <div className="leaf leaf-1">🌿</div>
          <div className="leaf leaf-2">🍃</div>
          <div className="leaf leaf-3">🌱</div>
          <div className="leaf leaf-4">🌿</div>
          <div className="leaf leaf-5">🍂</div>
        </div>
        
        <div className="dashboard-header">
          <div className="header-content">
            <h1>Parent Management</h1>
            <p className="header-subtitle">Register and manage parent's children in the system</p>
          </div>
          <div className="header-stats">
            <div className="stat-item">
              <span className="stat-value">{children.length}</span>
              <span className="stat-label">Total Children</span>
            </div>
            {children.length > 0 && (
              <>
                <button 
                  className="download-pdf-button"
                  onClick={downloadPDF}
                  disabled={isDownloading}
                >
                  {isDownloading ? (
                    <>
                      <span className="spinner-small"></span> Generating...
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" fill="currentColor"/>
                      </svg> Download PDF
                    </>
                  )}
                </button>
                <button className="bulk-delete-button" onClick={handleBulkDelete} disabled={isDeleting}>
                  Delete All
                </button>
              </>
            )}
          </div>
        </div>

        <div className="dashboard-content">
          {/* UPDATED FORM DESIGN */}
          <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', marginBottom: '30px' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '30px' }}>
              <div style={{ backgroundColor: '#65a36b', padding: '16px', borderRadius: '50%', marginBottom: '20px', boxShadow: '0 4px 15px rgba(101, 163, 107, 0.4)' }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" style={{ color: 'white' }}>
                  <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="currentColor"/>
                </svg>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #e5e7eb', paddingBottom: '25px', width: '100%', flexWrap: 'wrap', gap: '20px' }}>
                <h2 style={{ color: '#1b5e20', margin: 0, fontSize: '28px', fontWeight: 'bold' }}>Register New Child</h2>
                <p style={{ color: '#6b7280', margin: 0, fontSize: '15px', paddingLeft: '20px', borderLeft: '2px solid #d1d5db' }}>
                  Fill in the details to create a new<br />child profile
                </p>
              </div>
            </div>

            {error && (
              <div className="error-message" style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>⚠️</span> {error}
              </div>
            )}

            {success && (
              <div className="success-message" style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#dcfce3', color: '#166534', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>✅</span> {success}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px', marginBottom: '35px' }}>
                
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', color: '#1b5e20', marginBottom: '10px' }}>
                    Child ID <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={childId}
                    onChange={(e) => {
                      setChildId(e.target.value);
                      setError("");
                    }}
                    required
                    style={{ width: '100%', padding: '14px 16px', borderRadius: '8px', border: '1px solid #81c784', outline: 'none', backgroundColor: '#f0fdf4', fontSize: '15px' }}
                  />
                  <small style={{ color: '#6b7280', fontSize: '13px', marginTop: '8px', display: 'block' }}>
                    Auto-generated unique ID. You can modify it.
                  </small>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', color: '#1b5e20', marginBottom: '10px' }}>
                    Child Name <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., K. Kavindu"
                    value={childName}
                    onChange={(e) => {
                      setChildName(e.target.value);
                      setError(""); 
                    }}
                    required
                    style={{ width: '100%', padding: '14px 16px', borderRadius: '8px', border: '1px solid #81c784', outline: 'none', backgroundColor: '#ffffff', fontSize: '15px' }}
                  />
                  <small style={{ color: '#6b7280', fontSize: '13px', marginTop: '8px', display: 'block' }}>
                    Cannot have duplicate names. Case insensitive.
                  </small>
                </div>

              </div>

              <button 
                type="submit" 
                disabled={isSubmitting || isDeleting} 
                style={{ width: '100%', padding: '16px', backgroundColor: '#2e7d32', color: 'white', fontSize: '18px', fontWeight: 'bold', border: 'none', borderRadius: '50px', cursor: 'pointer', boxShadow: '0 8px 20px rgba(46, 125, 50, 0.3)', transition: 'background-color 0.2s', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}
              >
                {isSubmitting ? (
                  <>
                    <span className="spinner-small"></span> Registering...
                  </>
                ) : (
                  "Register Child"
                )}
              </button>
            </form>
          </div>

          <div className="list-card">
            <div className="list-header">
              <h3>Registered Children</h3>
              <span className="child-count">{children.length} Total</span>
            </div>

            {children.length === 0 ? (
              <div className="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" fill="#E0E0E0"/>
                </svg>
                <h4>No Children Registered</h4>
                <p>Get started by registering a new child using the form above</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="children-table">
                  <thead>
                    <tr>
                      <th>Child Details</th>
                      <th>Registered Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {children.map((child, index) => (
                      <tr key={child._id || index}>
                        <td>
                          <div className="child-info" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div className="child-avatar">
                              {child.childName.charAt(0).toUpperCase()}
                            </div>
                            <div className="child-details" style={{ display: 'flex', flexDirection: 'column' }}>
                              <span className="child-name" style={{ fontWeight: 'bold', fontSize: '1.05em' }}>
                                {child.childName}
                              </span>
                              <span className="id-badge" style={{ fontSize: '0.85em', color: '#6b7280', marginTop: '4px', width: 'max-content' }}>
                                {child.childId}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="date-badge">
                            {new Date(child.registeredDate).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                        </td>
                        <td>
                          <button
                            className="delete-button"
                            onClick={() => handleDeleteChild(child.childId, child.childName)}
                            disabled={isDeleting && deletingId === child.childId}
                            title={`Delete ${child.childName} and all associated data`}
                          >
                            {isDeleting && deletingId === child.childId ? (
                              <span className="spinner-small"></span>
                            ) : (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/>
                              </svg>
                            )}
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAddChild;