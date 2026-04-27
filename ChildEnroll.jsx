import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../css/ChildEnroll.css";
import UserNavbar from "../components/UserNavbar";

const ChildEnroll = () => {
  const navigate = useNavigate();
  
  const [loginType, setLoginType] = useState("child"); // "child" or "teacher"
  const [childId, setChildId] = useState("");
  const [childName, setChildName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  const [idError, setIdError] = useState("");
  const [nameError, setNameError] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [touched, setTouched] = useState({
    childId: false,
    childName: false,
    username: false,
    password: false
  });

  // Clear any existing sessions when reaching login page
  useEffect(() => {
    // Clear all existing sessions
    localStorage.removeItem("currentChild");
    localStorage.removeItem("currentTeacher");
    sessionStorage.clear();
  }, []);

  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError("");
        setSuccess("");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  // Child validation functions
  const validateChildId = (id) => {
    if (!id || id.trim() === "") {
      return "Child ID is required";
    }
    if (id.trim().length < 3) {
      return "Child ID must be at least 3 characters";
    }
    if (!/^[a-zA-Z0-9]+$/.test(id.trim())) {
      return "Child ID can only contain letters and numbers";
    }
    return "";
  };

  const validateChildName = (name) => {
    if (!name || name.trim() === "") {
      return "Password is required";
    }
    if (name.trim().length < 2) {
      return "Password must be at least 2 characters";
    }
    return "";
  };

  // Teacher validation functions
  const validateUsername = (user) => {
    if (!user || user.trim() === "") {
      return "Username is required";
    }
    if (user.trim().length < 3) {
      return "Username must be at least 3 characters";
    }
    if (user.trim().length > 50) {
      return "Username must be less than 50 characters";
    }
    return "";
  };

  const validatePassword = (pwd) => {
    if (!pwd || pwd.trim() === "") {
      return "Password is required";
    }
    if (pwd.trim().length < 6) {
      return "Password must be at least 6 characters";
    }
    if (pwd.trim().length > 100) {
      return "Password must be less than 100 characters";
    }
    return "";
  };

  // Child input handlers
  const handleIdChange = (e) => {
    const value = e.target.value;
    setChildId(value);
    if (touched.childId) {
      setIdError(validateChildId(value));
    }
    setError(""); 
  };

  const handleNameChange = (e) => {
    const value = e.target.value;
    setChildName(value);
    if (touched.childName) {
      setNameError(validateChildName(value));
    }
    setError(""); 
  };

  // Teacher input handlers
  const handleUsernameChange = (e) => {
    const value = e.target.value;
    setUsername(value);
    if (touched.username) {
      setUsernameError(validateUsername(value));
    }
    setError("");
  };

  const handlePasswordChange = (e) => {
    const value = e.target.value;
    setPassword(value);
    if (touched.password) {
      setPasswordError(validatePassword(value));
    }
    setError("");
  };

  // Child blur handlers
  const handleIdBlur = () => {
    setTouched({ ...touched, childId: true });
    setIdError(validateChildId(childId));
  };

  const handleNameBlur = () => {
    setTouched({ ...touched, childName: true });
    setNameError(validateChildName(childName));
  };

  // Teacher blur handlers
  const handleUsernameBlur = () => {
    setTouched({ ...touched, username: true });
    setUsernameError(validateUsername(username));
  };

  const handlePasswordBlur = () => {
    setTouched({ ...touched, password: true });
    setPasswordError(validatePassword(password));
  };

  const handleLoginTypeChange = (type) => {
    setLoginType(type);
    setError("");
    setSuccess("");
    // Reset form fields
    setChildId("");
    setChildName("");
    setUsername("");
    setPassword("");
    setIdError("");
    setNameError("");
    setUsernameError("");
    setPasswordError("");
    setTouched({
      childId: false,
      childName: false,
      username: false,
      password: false
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (loginType === "child") {
      await handleChildLogin();
    } else {
      await handleTeacherLogin();
    }
  };

  const handleChildLogin = async () => {
    const idValidationError = validateChildId(childId);
    const nameValidationError = validateChildName(childName);

    setIdError(idValidationError);
    setNameError(nameValidationError);

    if (idValidationError || nameValidationError) {
      return;
    }

    setIsSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const response = await axios.post("http://localhost:3002/child-enroll", {
        childId: childId.trim(),
        childName: childName.trim()
      });

      if (response.data.success) {
        setSuccess("✓ Successfully logged in! Redirecting to dashboard...");
        
        // Store session with timestamp and expiry
        const sessionData = {
          childId: response.data.child.childId,
          childName: response.data.child.childName,
          enrolledAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // 8 hours expiry
          hasChangedPassword: response.data.hasChangedPassword || false,
          userType: "child",
          lastActivity: new Date().toISOString()
        };
        
        localStorage.setItem("currentChild", JSON.stringify(sessionData));
        
        // Also store in sessionStorage for additional security
        sessionStorage.setItem("childSession", JSON.stringify({
          childId: response.data.child.childId,
          loginTime: new Date().toISOString()
        }));

        setTimeout(() => {
          // Check if password needs to be changed
          if (!response.data.hasChangedPassword) {
            navigate("/changepwd");
          } else {
            navigate("/childdashboard");
          }
        }, 2000);
      }
    } catch (err) {
      console.error("Enrollment error:", err);
      
      if (err.response) {
        switch (err.response.status) {
          case 401:
            setError("❌ Invalid Child ID or Password. Please try again.");
            break;
          case 403:
            setError("❌ Account is locked. Please contact administrator.");
            break;
          case 404:
            setError("❌ Child not found. Please check your credentials.");
            break;
          case 429:
            setError("❌ Too many login attempts. Please try again later.");
            break;
          case 500:
            setError("❌ Server error. Please try again later.");
            break;
          default:
            setError(err.response.data.error || "❌ Login failed. Please try again.");
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

  const handleTeacherLogin = async () => {
    const usernameValidationError = validateUsername(username);
    const passwordValidationError = validatePassword(password);

    setUsernameError(usernameValidationError);
    setPasswordError(passwordValidationError);

    if (usernameValidationError || passwordValidationError) {
      return;
    }

    setIsSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const response = await axios.post("http://localhost:3002/teacher-login", {
        username: username.trim(),
        password: password.trim()
      });

      if (response.data.success) {
        setSuccess("✓ Welcome back, " + response.data.teacher.teacherName + "! Redirecting to dashboard...");
        
        // Store session with timestamp and expiry
        const sessionData = {
          teacherId: response.data.teacher.teacherId,
          teacherName: response.data.teacher.teacherName,
          email: response.data.teacher.email,
          username: response.data.teacher.username,
          assignedClasses: response.data.teacher.assignedClasses,
          status: response.data.teacher.status,
          lastLogin: response.data.lastLogin,
          loginTime: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // 8 hours expiry
          userType: "teacher",
          lastActivity: new Date().toISOString(),
          permissions: response.data.teacher.permissions || ["view", "edit"]
        };
        
        localStorage.setItem("currentTeacher", JSON.stringify(sessionData));
        
        // Also store in sessionStorage for additional security
        sessionStorage.setItem("teacherSession", JSON.stringify({
          teacherId: response.data.teacher.teacherId,
          username: response.data.teacher.username,
          loginTime: new Date().toISOString()
        }));

        setTimeout(() => {
          navigate("/adminhome");
        }, 2000);
      }
    } catch (err) {
      console.error("Teacher login error:", err);
      
      if (err.response) {
        switch (err.response.status) {
          case 401:
            setError("❌ Invalid username or password. Please try again.");
            break;
          case 403:
            setError("❌ Account is disabled or locked. Please contact administrator.");
            break;
          case 404:
            setError("❌ Teacher account not found.");
            break;
          case 429:
            setError("❌ Too many login attempts. Please try again later.");
            break;
          case 500:
            setError("❌ Server error. Please try again later.");
            break;
          default:
            setError(err.response.data.error || "❌ Login failed. Please try again.");
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

  const handleForgotCredentials = () => {
    if (loginType === "child") {
      setError("Please contact your administrator or parent to retrieve your Child ID and reset your password.");
      // Optionally, you can show a modal with contact information
    } else {
      setError("Please contact your system administrator to reset your password.");
    }
  };

  // Handle Enter key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !isSubmitting) {
      handleSubmit(e);
    }
  };

  return (
    <div className="child-enroll-wrapper">
      <UserNavbar />
      <div className="enroll-container">
        <div className="nature-bg">
          <div className="leaf leaf-1">🌿</div>
          <div className="leaf leaf-2">🍃</div>
          <div className="leaf leaf-3">🌱</div>
          <div className="leaf leaf-4">🌿</div>
          <div className="leaf leaf-5">🍂</div>
        </div>

        <div className="enroll-card">
          <div className="enroll-header">
            <div className="header-icon">
              <span className="tree-icon">{loginType === "child" ? "🌳" : "👩‍🏫"}</span>
            </div>
            <h1>{loginType === "child" ? "Parent Login" : "Teacher Login"}</h1>
            <p className="header-subtitle" style={{color:"black"}}>
              {loginType === "child" 
                ? "Welcome back! Enter your Child ID and password to continue." 
                : "Welcome back! Enter your username and password to access the admin panel."}
            </p>
          </div>

          {/* Login Type Toggle */}
          <div className="login-type-toggle">
            <button
              type="button"
              className={`toggle-btn ${loginType === "child" ? "active" : ""}`}
              onClick={() => handleLoginTypeChange("child")}
              disabled={isSubmitting}
            >
              <span className="toggle-icon">👧</span>
              Parent Login
            </button>
            <button
              type="button"
              className={`toggle-btn ${loginType === "teacher" ? "active" : ""}`}
              onClick={() => handleLoginTypeChange("teacher")}
              disabled={isSubmitting}
            >
              <span className="toggle-icon">👩‍🏫</span>
              Teacher Login
            </button>
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

          <form onSubmit={handleSubmit} className="enroll-form" onKeyPress={handleKeyPress}>
            {loginType === "child" ? (
              <>
                <div className="form-group">
                  <label htmlFor="childId">
                    <span className="label-icon">🆔</span>
                    Child ID
                  </label>
                  <div className={`input-wrapper ${idError ? 'error' : ''}`}>
                    <input
                      type="text"
                      id="childId"
                      placeholder="Enter your Child ID"
                      value={childId}
                      onChange={handleIdChange}
                      onBlur={handleIdBlur}
                      disabled={isSubmitting}
                      className={idError ? 'input-error' : ''}
                      autoComplete="off"
                      maxLength="50"
                    />
                    {childId && !idError && touched.childId && (
                      <span className="input-valid">✓</span>
                    )}
                  </div>
                  {idError && <span className="error-text">{idError}</span>}
                  <small className="input-hint">
                    Use the Child ID provided by your parent/guardian
                  </small>
                </div>

                <div className="form-group">
                  <label htmlFor="childName">
                    <span className="label-icon">🔑</span>
                    Password
                  </label>
                  <div className={`input-wrapper ${nameError ? 'error' : ''}`}>
                    <input
                      type={showPassword ? "text" : "password"}
                      id="childName"
                      placeholder="Enter your password"
                      value={childName}
                      onChange={handleNameChange}
                      onBlur={handleNameBlur}
                      disabled={isSubmitting}
                      className={nameError ? 'input-error' : ''}
                      autoComplete="off"
                      maxLength="100"
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex="-1"
                      disabled={isSubmitting}
                    >
                      {showPassword ? "👁️" : "👁️‍🗨️"}
                    </button>
                    {childName && !nameError && touched.childName && (
                      <span className="input-valid">✓</span>
                    )}
                  </div>
                  {nameError && <span className="error-text">{nameError}</span>}
                  <small className="input-hint">
                    {touched.childName && !childName ? "Enter your password" : "Enter your password (case-sensitive)"}
                  </small>
                </div>
              </>
            ) : (
              <>
                <div className="form-group">
                  <label htmlFor="username">
                    <span className="label-icon">👤</span>
                    Username
                  </label>
                  <div className={`input-wrapper ${usernameError ? 'error' : ''}`}>
                    <input
                      type="text"
                      id="username"
                      placeholder="Enter your username"
                      value={username}
                      onChange={handleUsernameChange}
                      onBlur={handleUsernameBlur}
                      disabled={isSubmitting}
                      className={usernameError ? 'input-error' : ''}
                      autoComplete="off"
                      maxLength="50"
                    />
                    {username && !usernameError && touched.username && (
                      <span className="input-valid">✓</span>
                    )}
                  </div>
                  {usernameError && <span className="error-text">{usernameError}</span>}
                  <small className="input-hint">
                    Enter your teacher username (case-sensitive)
                  </small>
                </div>

                <div className="form-group">
                  <label htmlFor="password">
                    <span className="label-icon">🔑</span>
                    Password
                  </label>
                  <div className={`input-wrapper ${passwordError ? 'error' : ''}`}>
                    <input
                      type={showPassword ? "text" : "password"}
                      id="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={handlePasswordChange}
                      onBlur={handlePasswordBlur}
                      disabled={isSubmitting}
                      className={passwordError ? 'input-error' : ''}
                      autoComplete="off"
                      maxLength="100"
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex="-1"
                      disabled={isSubmitting}
                    >
                      {showPassword ? "👁️" : "👁️‍🗨️"}
                    </button>
                    {password && !passwordError && touched.password && (
                      <span className="input-valid">✓</span>
                    )}
                  </div>
                  {passwordError && <span className="error-text">{passwordError}</span>}
                  <small className="input-hint">
                    Enter your password (case-sensitive)
                  </small>
                </div>
              </>
            )}

            <button 
              type="submit" 
              className={`enroll-button ${isSubmitting ? 'submitting' : ''}`}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner"></span>
                  Logging in...
                </>
              ) : (
                <>
                  <span className="button-icon">{loginType === "child" ? "🌱" : "👩‍🏫"}</span>
                  Login
                </>
              )}
            </button>

            <div className="help-section">
              <p className="help-text">
                <span className="help-icon">❓</span>
                {loginType === "child" 
                  ? "First time here? Use your name as the password." 
                  : "Having trouble logging in? Contact your administrator."}
              </p>
              <button 
                type="button" 
                className="forgot-link"
                onClick={handleForgotCredentials}
                disabled={isSubmitting}
              >
                Forgot your password?
              </button>
            </div>
          </form>

          <div className="enroll-footer">
            <div className="footer-decoration">
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
            </div>
            <p className="footer-text">
              Secure login powered by nature's protection 🌿
            </p>
            <p className="security-note">
              🔒 Your session is encrypted and secure
            </p>
          </div>
        </div>

        <div className="fun-facts">
          <div className="fact-card">
            <span className="fact-icon">🌟</span>
            <p className="fact-text">Learning is an adventure!</p>
          </div>
          <div className="fact-card">
            <span className="fact-icon">📚</span>
            <p className="fact-text">Every day is a new discovery</p>
          </div>
          <div className="fact-card">
            <span className="fact-icon">🎨</span>
            <p className="fact-text">Be creative, be yourself</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChildEnroll;