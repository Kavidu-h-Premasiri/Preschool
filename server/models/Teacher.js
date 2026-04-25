const mongoose = require("mongoose");

const TeacherSchema = new mongoose.Schema(
  {
    teacherId: {
      type: String,
      required: [true, "Teacher ID is required"],
      trim: true,
      unique: true,
      uppercase: true
    },
    teacherName: {
      type: String,
      required: [true, "Teacher name is required"],
      trim: true
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      unique: true,
      validate: {
        validator: function(v) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: props => `${props.value} is not a valid email address!`
      }
    },
    phoneNumber: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      validate: {
        validator: function(v) {
          return /^0\d{9}$/.test(v);
        },
        message: props => `${props.value} is not a valid phone number! Must be 10 digits starting with 0`
      }
    },
    alternatePhone: {
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          return !v || /^0\d{9}$/.test(v);
        },
        message: props => `${props.value} is not a valid phone number! Must be 10 digits starting with 0`
      }
    },
    dateOfBirth: {
      type: Date,
      required: [true, "Date of birth is required"]
    },
    gender: {
      type: String,
      required: [true, "Gender is required"],
      enum: ["Male", "Female", "Other"]
    },
    address: {
      street: { 
        type: String, 
        required: [true, "Street address is required"] 
      },
      city: { 
        type: String, 
        required: [true, "City is required"] 
      },
      state: { 
        type: String, 
        required: [true, "State is required"] 
      },
      postalCode: { 
        type: String, 
        required: [true, "Postal code is required"] 
      }
    },
    qualification: {
      type: String,
      required: [true, "Qualification is required"],
      enum: [
        "Diploma in Early Childhood Education", 
        "Bachelor's in Education", 
        "Master's in Education", 
        "PhD in Education", 
        "Montessori Certified", 
        "Other"
      ]
    },
    specialization: {
      type: String,
      required: [true, "Specialization is required"],
      enum: [
        "Early Childhood Education", 
        "Special Education", 
        "Montessori Method", 
        "Play-Based Learning", 
        "Language Development", 
        "Child Psychology", 
        "Other"
      ]
    },
    experience: {
      type: Number,
      required: [true, "Years of experience is required"],
      min: [0, "Experience cannot be negative"],
      max: [50, "Experience cannot exceed 50 years"]
    },
    previousSchool: {
      type: String,
      trim: true
    },
    assignedClasses: [{
      className: {
        type: String,
        enum: ["LKG", "UKG", "Daycare", "Nursery"]
      },
      section: {
        type: String,
        trim: true,
        default: ""
      },
      isClassTeacher: {
        type: Boolean,
        default: false
      },
      assignedDate: {
        type: Date,
        default: Date.now
      },
      academicYear: {
        type: String,
        default: function() {
          const year = new Date().getFullYear();
          return `${year}-${year + 1}`;
        }
      }
    }],
    primaryClass: {
      className: {
        type: String,
        enum: ["LKG", "UKG", "Daycare", "Nursery", ""],
        default: ""
      },
      section: {
        type: String,
        default: ""
      }
    },
    joiningDate: {
      type: Date,
      required: [true, "Joining date is required"],
      default: Date.now
    },
    employmentType: {
      type: String,
      required: [true, "Employment type is required"],
      enum: ["Full-time", "Part-time", "Contract", "Probation", "Intern"]
    },
    emergencyContact: {
      name: { 
        type: String, 
        required: [true, "Emergency contact name is required"] 
      },
      relationship: { 
        type: String, 
        required: [true, "Emergency contact relationship is required"] 
      },
      phone: { 
        type: String, 
        required: [true, "Emergency contact phone is required"],
        validate: {
          validator: function(v) {
            return /^0\d{9}$/.test(v);
          },
          message: props => `${props.value} is not a valid phone number! Must be 10 digits starting with 0`
        }
      }
    },
    bankDetails: {
      accountHolderName: { 
        type: String,
        default: "" 
      },
      accountNumber: { 
        type: String,
        default: "" 
      },
      bankName: { 
        type: String,
        default: "" 
      },
      branch: { 
        type: String,
        default: "" 
      },
      ifscCode: { 
        type: String,
        default: "" 
      }
    },
    // Profile Photo - New field
    profilePhoto: {
      data: {
        type: String, // Base64 encoded image data
        default: null
      },
      contentType: {
        type: String, // MIME type (e.g., 'image/jpeg', 'image/png')
        default: null
      },
      fileName: {
        type: String, // Original file name
        default: null
      },
      updatedAt: {
        type: Date,
        default: Date.now
      }
    },
    documents: {
      resume: { 
        type: String,
        default: "" 
      },
      degreeCertificate: { 
        type: String,
        default: "" 
      },
      idProof: { 
        type: String,
        default: "" 
      },
      addressProof: { 
        type: String,
        default: "" 
      }
    },
    skills: [{
      type: String,
      enum: [
        "Classroom Management", 
        "Lesson Planning", 
        "Child Development", 
        "Parent Communication", 
        "Creative Arts", 
        "Music", 
        "Storytelling", 
        "First Aid", 
        "Other"
      ]
    }],
    languages: [{
      type: String,
      enum: ["English", "Sinhala", "Tamil", "Other"]
    }],
    status: {
      type: String,
      enum: ["Active", "On Leave", "Resigned", "Terminated", "Probation"],
      default: "Active"
    },
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
      lowercase: true
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"]
    },
    lastLogin: {
      type: Date,
      default: null
    },
    createdBy: {
      type: String,
      required: [true, "Creator ID is required"]
    }
  },
  {
    timestamps: true
  }
);

// Indexes
TeacherSchema.index({ "assignedClasses.className": 1 });
TeacherSchema.index({ status: 1 });
TeacherSchema.index({ email: 1 });

// Method to check if teacher is assigned to a specific class
TeacherSchema.methods.isAssignedToClass = function(className, section) {
  return this.assignedClasses.some(c => 
    c.className === className && (!section || c.section === section)
  );
};

// Method to get all classes taught by teacher
TeacherSchema.methods.getTeachingClasses = function() {
  return this.assignedClasses.map(c => ({
    className: c.className,
    section: c.section,
    isClassTeacher: c.isClassTeacher,
    academicYear: c.academicYear
  }));
};

// Static method to find teachers by class
TeacherSchema.statics.findByClass = function(className, section) {
  const query = { 
    "assignedClasses.className": className,
    status: "Active"
  };
  if (section) {
    query["assignedClasses.section"] = section;
  }
  return this.find(query);
};

// Static method to find class teachers
TeacherSchema.statics.findClassTeachers = function(className, section) {
  const query = { 
    "assignedClasses.className": className,
    "assignedClasses.isClassTeacher": true,
    status: "Active"
  };
  if (section) {
    query["assignedClasses.section"] = section;
  }
  return this.find(query);
};

// Method to get profile photo as data URL
TeacherSchema.methods.getProfilePhotoUrl = function() {
  if (this.profilePhoto && this.profilePhoto.data && this.profilePhoto.contentType) {
    return `data:${this.profilePhoto.contentType};base64,${this.profilePhoto.data}`;
  }
  return null;
};

// Create and export the model
const Teacher = mongoose.model("Teacher", TeacherSchema);

module.exports = Teacher;