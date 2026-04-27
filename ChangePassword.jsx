import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../css/ChangePassword.css";
import UserNavbar from '../components/UserNavbar';

const ChangePassword = () => {
  const navigate = useNavigate();
  
  const [childData, setChildData] = useState(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [hasChangedPassword, setHasChangedPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [touched, setTouched] = useState({
    currentPassword: false,
    newPassword: false,
    confirmNewPassword: false
  });
  
  const [errors, setErrors] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: ""
  });

  useEffect(() => {
    // Get child data from localStorage
    const storedChild = localStorage.getItem("currentChild");
    if (storedChild) {
      const child = JSON.parse(storedChild);
      setChildData(child);
      
      // Check if the child has already changed password
      checkPasswordStatus(child.childId);
    } else {
      // Redirect to enroll if no child data
      navigate("/child-enroll");
    }
  }, [navigate]);

  const checkPasswordStatus = async (childId) => {
    try {
      const response = await axios.post("http://localhost:3002/check-password-status", {
        childId: childId
      });
      
      setHasChangedPassword(response.data.hasChangedPassword);
      
      // If already changed password, check profile status and redirect accordingly
      if (response.data.hasChangedPassword) {
        checkProfileStatus(childId);
      }
    } catch (err) {
      console.error("Error checking password status:", err);
    } finally {
      setLoading(false);
    }
  };

  const checkProfileStatus = async (childId) => {
    try {
      const response = await axios.get(`http://localhost:3002/check-profile/${childId}`);
      
      if (response.data.exists) {
        // Profile exists, go to dashboard
        navigate("/childdashboard");
      } else {
        // Profile doesn't exist, show message and then go to profile form
        setError("You have already changed your password. Please complete your profile.");
        setTimeout(() => {
          navigate("/studentprofileform");
        }, 3000);
      }
    } catch (err) {
      console.error("Error checking profile status:", err);
    }
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

  const validateCurrentPassword = (value) => {
    if (!value || value.trim() === "") {
      return "Current password is required";
    }
    return "";
  };

  const validateNewPassword = (value) => {
    if (!value || value.trim() === "") {
      return "New password is required";
    }
    if (value.trim().length < 3) {
      return "Password must be at least 3 characters long";
    }
    if (value.trim().toLowerCase() === currentPassword.trim().toLowerCase()) {
      return "New password cannot be the same as current password";
    }
    return "";
  };

  const validateConfirmPassword = (value) => {
    if (!value || value.trim() === "") {
      return "Please confirm your new password";
    }
    if (value.trim() !== newPassword.trim()) {
      return "Passwords do not match";
    }
    return "";
  };

  const handleCurrentPasswordChange = (e) => {
    const value = e.target.value;
    setCurrentPassword(value);
    if (touched.currentPassword) {
      setErrors({
        ...errors,
        currentPassword: validateCurrentPassword(value)
      });
    }
    setError("");
  };

  const handleNewPasswordChange = (e) => {
    const value = e.target.value;
    setNewPassword(value);
    if (touched.newPassword) {
      setErrors({
        ...errors,
        newPassword: validateNewPassword(value)
      });
    }
    // Also validate confirm password if it's already touched
    if (touched.confirmNewPassword && confirmNewPassword) {
      setErrors({
        ...errors,
        newPassword: validateNewPassword(value),
        confirmNewPassword: validateConfirmPassword(confirmNewPassword)
      });
    }
    setError("");
  };

  const handleConfirmPasswordChange = (e) => {
    const value = e.target.value;
    setConfirmNewPassword(value);
    if (touched.confirmNewPassword) {
      setErrors({
        ...errors,
        confirmNewPassword: validateConfirmPassword(value)
      });
    }
    setError("");
  };

  const handleCurrentPasswordBlur = () => {
    setTouched({ ...touched, currentPassword: true });
    setErrors({
      ...errors,
      currentPassword: validateCurrentPassword(currentPassword)
    });
  };

  const handleNewPasswordBlur = () => {
    setTouched({ ...touched, newPassword: true });
    setErrors({
      ...errors,
      newPassword: validateNewPassword(newPassword)
    });
  };

  const handleConfirmPasswordBlur = () => {
    setTouched({ ...touched, confirmNewPassword: true });
    setErrors({
      ...errors,
      confirmNewPassword: validateConfirmPassword(confirmNewPassword)
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Double check if already changed password
    if (hasChangedPassword) {
      checkProfileStatus(childData.childId);
      return;
    }
    
    const currentPwdError = validateCurrentPassword(currentPassword);
    const newPwdError = validateNewPassword(newPassword);
    const confirmPwdError = validateConfirmPassword(confirmNewPassword);

    setErrors({
      currentPassword: currentPwdError,
      newPassword: newPwdError,
      confirmNewPassword: confirmPwdError
    });

    if (currentPwdError || newPwdError || confirmPwdError) {
      return;
    }

    setIsSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const response = await axios.post("http://localhost:3002/change-password", {
        childId: childData.childId,
        currentPassword: currentPassword.trim(),
        newPassword: newPassword.trim(),
        confirmNewPassword: confirmNewPassword.trim()
      });

      if (response.data.success) {
        setSuccess("✓ " + response.data.message);
        
        // Update localStorage to indicate password has been changed
        const updatedChildData = {
          ...childData,
          hasChangedPassword: true,
          passwordChangedAt: new Date().toISOString()
        };
        localStorage.setItem("currentChild", JSON.stringify(updatedChildData));
        
        // Clear form
        setCurrentPassword("");
        setNewPassword("");
        setConfirmNewPassword("");
        setTouched({
          currentPassword: false,
          newPassword: false,
          confirmNewPassword: false
        });
        
        // Check profile status and redirect accordingly
        setTimeout(() => {
          checkProfileStatus(childData.childId);
        }, 2000);
      }
    } catch (err) {
      console.error("Password change error:", err);
      
      if (err.response) {
        const field = err.response.data.field;
        const errorMsg = err.response.data.error || "Password change failed";
        
        if (field === "currentPassword") {
          setErrors({ ...errors, currentPassword: errorMsg });
        } else if (field === "newPassword") {
          setErrors({ ...errors, newPassword: errorMsg });
        } else if (field === "confirmNewPassword") {
          setErrors({ ...errors, confirmNewPassword: errorMsg });
        } else {
          setError("❌ " + errorMsg);
        }
      } else if (err.request) {
        setError("❌ Cannot connect to server. Please check your connection.");
      } else {
        setError("❌ An unexpected error occurred.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate("/childdashboard");
  };

  if (loading) {
    return (
      <div className="change-password-wrapper">
        <UserNavbar />
        <div className="password-change-container">
          <div className="loading-spinner">Loading...</div>
        </div>
      </div>
    );
  }

  // If already changed password, show message and redirect based on profile status
  if (hasChangedPassword) {
    return (
      <div className="change-password-wrapper">
        <UserNavbar />
        <div className="password-change-container">
          <div className="password-card">
            <div className="password-header">
              <div className="header-icon">
                <span className="lock-icon">🔒</span>
              </div>
              <h1>Password Already Changed</h1>
              <p className="header-subtitle">
                You have already changed your password. Password can only be changed once.
              </p>
              <p className="redirect-message">
                Checking your profile status...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="change-password-wrapper">
      <UserNavbar />
      <div className="password-change-container">
        <div className="nature-bg">
          <div className="leaf leaf-1">🌿</div>
          <div className="leaf leaf-2">🍃</div>
          <div className="leaf leaf-3">🌱</div>
          <div className="leaf leaf-4">🌿</div>
          <div className="leaf leaf-5">🍂</div>
        </div>

        <div className="password-card">
          <div className="password-header">
            <div className="header-icon">
              <span className="lock-icon">🔐</span>
            </div>
            <h1>Change Your Password</h1>
            <p className="header-subtitle">
              Create a new password to keep your account secure
            </p>
            <div className="warning-badge">
              <span className="warning-icon">⚠️</span>
              <span className="warning-text">You can only change your password once</span>
            </div>
            {childData && (
              <div className="child-info-badge">
                <span className="child-id-label">Child ID:</span>
                <span className="child-id-value">{childData.childId}</span>
              </div>
            )}
          </div>

          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}

          {success && (
            <div className="success-message">
              <span className="success-icon">✓</span>
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="password-form">
            <div className="form-group">
              <label htmlFor="currentPassword">
                <span className="label-icon">🔑</span>
                Current Password (Your Name)
              </label>
              <div className={`input-wrapper ${errors.currentPassword ? 'error' : ''}`}>
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  id="currentPassword"
                  placeholder="Enter your name (current password)"
                  value={currentPassword}
                  onChange={handleCurrentPasswordChange}
                  onBlur={handleCurrentPasswordBlur}
                  disabled={isSubmitting}
                  className={errors.currentPassword ? 'input-error' : ''}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  tabIndex="-1"
                >
                  {showCurrentPassword ? "👁️" : "👁️‍🗨️"}
                </button>
                {currentPassword && !errors.currentPassword && touched.currentPassword && (
                  <span className="input-valid">✓</span>
                )}
              </div>
              {errors.currentPassword && <span className="error-text">{errors.currentPassword}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="newPassword">
                <span className="label-icon">🆕</span>
                New Password
              </label>
              <div className={`input-wrapper ${errors.newPassword ? 'error' : ''}`}>
                <input
                  type={showNewPassword ? "text" : "password"}
                  id="newPassword"
                  placeholder="Enter your new password"
                  value={newPassword}
                  onChange={handleNewPasswordChange}
                  onBlur={handleNewPasswordBlur}
                  disabled={isSubmitting}
                  className={errors.newPassword ? 'input-error' : ''}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  tabIndex="-1"
                >
                  {showNewPassword ? "👁️" : "👁️‍🗨️"}
                </button>
                {newPassword && !errors.newPassword && touched.newPassword && (
                  <span className="input-valid">✓</span>
                )}
              </div>
              {errors.newPassword && <span className="error-text">{errors.newPassword}</span>}
              <small className="input-hint">
                Choose a password that's easy to remember but hard to guess
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="confirmNewPassword">
                <span className="label-icon">✓</span>
                Confirm New Password
              </label>
              <div className={`input-wrapper ${errors.confirmNewPassword ? 'error' : ''}`}>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  id="confirmNewPassword"
                  placeholder="Confirm your new password"
                  value={confirmNewPassword}
                  onChange={handleConfirmPasswordChange}
                  onBlur={handleConfirmPasswordBlur}
                  disabled={isSubmitting}
                  className={errors.confirmNewPassword ? 'input-error' : ''}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex="-1"
                >
                  {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
                </button>
                {confirmNewPassword && !errors.confirmNewPassword && touched.confirmNewPassword && (
                  <span className="input-valid">✓</span>
                )}
              </div>
              {errors.confirmNewPassword && <span className="error-text">{errors.confirmNewPassword}</span>}
            </div>

            <div className="password-requirements">
              <p className="requirements-title">Password requirements:</p>
              <ul className="requirements-list">
                <li className={newPassword.length >= 3 ? "met" : ""}>
                  <span className="req-icon">{newPassword.length >= 3 ? "✓" : "•"}</span>
                  At least 3 characters long
                </li>
                <li className={newPassword !== currentPassword && currentPassword ? "met" : ""}>
                  <span className="req-icon">{newPassword !== currentPassword && currentPassword ? "✓" : "•"}</span>
                  Different from current password
                </li>
                <li className={newPassword === confirmNewPassword && newPassword ? "met" : ""}>
                  <span className="req-icon">{newPassword === confirmNewPassword && newPassword ? "✓" : "•"}</span>
                  Passwords match
                </li>
              </ul>
            </div>

            <div className="warning-message">
              <span className="warning-icon">⚠️</span>
              <span className="warning-text">
                This action cannot be undone. After changing your password, you won't be able to change it again.
              </span>
            </div>

            <div className="button-group">
              <button 
                type="submit" 
                className={`change-button ${isSubmitting ? 'submitting' : ''}`}
                disabled={isSubmitting || hasChangedPassword}
              >
                {isSubmitting ? (
                  <>
                    <span className="spinner"></span>
                    Changing Password...
                  </>
                ) : (
                  <>
                    <span className="button-icon">🔒</span>
                    Change Password (One-time Only)
                  </>
                )}
              </button>
              
              <button 
                type="button" 
                className="cancel-button"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                Cancel
              </button>
            </div>

            <div className="help-section">
              <p className="help-text">
                <span className="help-icon">💡</span>
                After changing your password, you'll need to use your new password to login next time. You cannot change it again.
              </p>
            </div>
          </form>

          <div className="password-footer">
            <div className="footer-decoration">
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
            </div>
            <p className="footer-text">
              Keep your password safe and secure 🌿
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChangePassword;