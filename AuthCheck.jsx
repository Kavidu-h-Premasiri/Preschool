// components/AuthCheck.jsx
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const AuthCheck = ({ children }) => {
  const navigate = useNavigate();
  
  useEffect(() => {
    const childData = localStorage.getItem("currentChild");
    const teacherData = localStorage.getItem("currentTeacher");
    
    if (childData) {
      // If already logged in as child, redirect to child dashboard
      if (window.location.pathname === "/childenroll") {
        navigate("/childdashboard");
      }
    } else if (teacherData) {
      // If already logged in as teacher, redirect to admin home
      if (window.location.pathname === "/childenroll") {
        navigate("/adminhome");
      }
    }
  }, [navigate]);
  
  return children;
};

export default AuthCheck;