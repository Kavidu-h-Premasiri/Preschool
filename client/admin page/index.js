require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const fs = require("fs");


// --- MODELS ---
const ChildModel = require("./models/Child.js");
const NewChildPwdModel = require("./models/NewChildPwd.js");
const StudentProfileModel = require("./models/StudentProfile.js");
const EventModel = require("./models/Event.js");
const TeacherModel = require("./models/Teacher.js");
const DaycareAttendanceModel = require("./models/DaycareAttendance.js");
const EventPhotoModel = require("./models/EventPhoto.js");
const Attendance = require("./models/Attendance");
const Worksheet = require("./models/Worksheet");

const app = express();

// --- ADD WORKSHEET ROUTES ---
const worksheetRoutes = require("./routes/worksheets");
// --- UPDATED MIDDLEWARE ---
// Increased limit to 50mb to allow for Base64 profile photo uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

app.use("/worksheets", worksheetRoutes);

// --- MONGODB CONNECTION ---
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected successfully");
    // Run status update every hour
    setInterval(async () => {
      try {
        await EventModel.updateAllStatuses();
        console.log("Event statuses updated automatically");
      } catch (err) {
        console.error("Error updating event statuses:", err);
      }
    }, 60 * 60 * 1000); // Every hour
  })
  .catch((err) => console.log("MongoDB connection error:", err));

/* ================================
   CHILD MANAGEMENT API
================================ */

// 1. ADD NEW CHILD
app.post("/add-child", async (req, res) => {
  try {
    const { childId, childName } = req.body;

    const trimmedId = childId?.trim();
    const trimmedName = childName?.trim();

    if (!trimmedId) {
      return res.status(400).json({ error: "Child ID is required", field: "childId" });
    }

    if (!trimmedName) {
      return res.status(400).json({ error: "Child Name is required", field: "childName" });
    }

    const existingId = await ChildModel.findOne({ 
      childId: { $regex: new RegExp(`^${trimmedId}$`, 'i') }
    });
    
    if (existingId) {
      return res.status(400).json({ error: `Child ID "${trimmedId}" already exists`, field: "childId", code: 11000 });
    }

    const existingName = await ChildModel.findOne({ 
      childName: { $regex: new RegExp(`^${trimmedName}$`, 'i') }
    });
    
    if (existingName) {
      return res.status(400).json({ error: `Child Name "${trimmedName}" already exists`, field: "childName", code: 11000 });
    }

    const newChild = new ChildModel({
      childId: trimmedId,
      childName: trimmedName
    });

    const savedChild = await newChild.save();
    res.status(201).json(savedChild);

  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      const value = err.keyValue[field];
      return res.status(400).json({
        error: `${field === 'childId' ? 'Child ID' : 'Child Name'} "${value}" already exists`,
        field: field, code: 11000, keyPattern: err.keyPattern, keyValue: err.keyValue
      });
    }

    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ error: errors.join(', '), validationErrors: err.errors });
    }

    console.error("Server error:", err);
    res.status(500).json({ error: "Internal server error. Please try again." });
  }
});

// 2. GET ALL CHILDREN
app.get("/children", async (req, res) => {
  try {
    const children = await ChildModel.find().sort({ registeredDate: -1 });
    res.json(children);
  } catch (err) {
    console.error("Error fetching children:", err);
    res.status(500).json({ error: "Failed to fetch children data" });
  }
});

// 3. CHILD ENROLLMENT (LOGIN)
app.post("/child-enroll", async (req, res) => {
  try {
    console.log("👉 Incoming request body:", req.body);

    const { childId, childName } = req.body;

    const trimmedId = childId?.trim();
    const trimmedPassword = childName?.trim(); // (you are using this as password)

    console.log("👉 Trimmed values:", { trimmedId, trimmedPassword });

    if (!trimmedId || !trimmedPassword) {
      return res.status(400).json({
        error: "Child ID and Password are required"
      });
    }

    // STEP 1: find child by ID only
    const child = await ChildModel.findOne({
      childId: { $regex: new RegExp(`^${trimmedId}$`, "i") }
    });

    console.log("👉 Child from DB:", child);

    if (!child) {
      console.log("❌ LOGIN FAILED - child not found");
      return res.status(401).json({
        error: "Invalid Child ID or Password"
      });
    }

    // STEP 2: check if password changed
    const pwdRecord = await NewChildPwdModel.findOne({
      childId: { $regex: new RegExp(`^${trimmedId}$`, "i") }
    });

    console.log("👉 Password record:", pwdRecord);

    let isValid = false;

    // CASE A: user has changed password
    if (pwdRecord) {
      isValid =
        pwdRecord.newPassword.toLowerCase() ===
        trimmedPassword.toLowerCase();
    }
    // CASE B: default login (childName used as password)
    else {
      isValid =
        child.childName.toLowerCase() ===
        trimmedPassword.toLowerCase();
    }

    if (!isValid) {
      console.log("❌ LOGIN FAILED - wrong password");
      return res.status(401).json({
        error: "Invalid Child ID or Password"
      });
    }

    console.log("✅ LOGIN SUCCESS");

    return res.json({
      success: true,
      message: "Successfully enrolled",
      child: {
        childId: child.childId,
        childName: child.childName
      }
    });

  } catch (err) {
    console.error("🔥 Enrollment error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 4. CHANGE PASSWORD
app.post("/change-password", async (req, res) => {
  try {
    const { childId, currentPassword, newPassword, confirmNewPassword } = req.body;

    const trimmedId = childId?.trim();
    const trimmedCurrentPwd = currentPassword?.trim();
    const trimmedNewPwd = newPassword?.trim();
    const trimmedConfirmPwd = confirmNewPassword?.trim();

    if (!trimmedId || !trimmedCurrentPwd || !trimmedNewPwd || !trimmedConfirmPwd) {
      return res.status(400).json({ 
        error: "All fields are required",
        fields: { childId: !trimmedId, currentPassword: !trimmedCurrentPwd, 
                 newPassword: !trimmedNewPwd, confirmNewPassword: !trimmedConfirmPwd }
      });
    }

    if (trimmedNewPwd !== trimmedConfirmPwd) {
      return res.status(400).json({ 
        error: "New password and confirm password do not match",
        field: "confirmNewPassword"
      });
    }

    if (trimmedNewPwd.length < 3) {
      return res.status(400).json({
        error: "New password must be at least 3 characters long",
        field: "newPassword"
      });
    }

    const child = await ChildModel.findOne({
      childId: { $regex: new RegExp(`^${trimmedId}$`, 'i') }
    });

    if (!child) {
      return res.status(404).json({ 
        error: "Child not found",
        field: "childId"
      });
    }

    const existingNewPwd = await NewChildPwdModel.findOne({
      childId: { $regex: new RegExp(`^${trimmedId}$`, 'i') }
    });

    if (existingNewPwd) {
      return res.status(400).json({ 
        error: "You have already changed your password. Password can only be changed once.",
        field: "general"
      });
    }

    if (child.childName.toLowerCase() !== trimmedCurrentPwd.toLowerCase()) {
      return res.status(401).json({ 
        error: "Current password is incorrect",
        field: "currentPassword"
      });
    }

    if (child.childName.toLowerCase() === trimmedNewPwd.toLowerCase()) {
      return res.status(400).json({
        error: "New password cannot be the same as your name",
        field: "newPassword"
      });
    }

    const newChildPwd = new NewChildPwdModel({
      childId: child.childId,
      childName: child.childName,
      newPassword: trimmedNewPwd,
      passwordChangedAt: new Date()
    });
    
    await newChildPwd.save();

    res.json({
      success: true,
      message: "Password changed successfully! From now on, use your new password to login. You cannot change it again.",
      childId: child.childId
    });

  } catch (err) {
    console.error("Password change error:", err);
    
    if (err.code === 11000) {
      return res.status(400).json({ 
        error: "You have already changed your password. Password can only be changed once.",
        field: "general"
      });
    }
    
    res.status(500).json({ error: "Server error during password change. Please try again." });
  }
});

// 5. CHECK IF CHILD HAS CHANGED PASSWORD
app.post("/check-password-status", async (req, res) => {
  try {
    const { childId } = req.body;

    const trimmedId = childId?.trim();

    if (!trimmedId) {
      return res.status(400).json({ error: "Child ID is required" });
    }

    const existingNewPwd = await NewChildPwdModel.findOne({
      childId: { $regex: new RegExp(`^${trimmedId}$`, 'i') }
    });

    res.json({
      hasChangedPassword: !!existingNewPwd,
      passwordChangedAt: existingNewPwd ? existingNewPwd.passwordChangedAt : null
    });

  } catch (err) {
    console.error("Error checking password status:", err);
    res.status(500).json({ error: "Server error. Please try again." });
  }
});

// 6. GET ALL CHILDREN WITH PASSWORD STATUS
app.get("/children-with-status", async (req, res) => {
  try {
    const children = await ChildModel.find().sort({ registeredDate: -1 });
    
    const passwordChanges = await NewChildPwdModel.find();
    
    const passwordChangeMap = {};
    passwordChanges.forEach(change => {
      passwordChangeMap[change.childId.toLowerCase()] = {
        hasChangedPassword: true,
        passwordChangedAt: change.passwordChangedAt,
        lastUsed: change.lastUsed
      };
    });
    
    const childrenWithStatus = children.map(child => ({
      ...child.toObject(),
      passwordStatus: passwordChangeMap[child.childId.toLowerCase()] || {
        hasChangedPassword: false,
        passwordChangedAt: null,
        lastUsed: null
      }
    }));
    
    res.json(childrenWithStatus);
  } catch (err) {
    console.error("Error fetching children with status:", err);
    res.status(500).json({ error: "Failed to fetch children data" });
  }
});

// 7. GET CHILD NAME BY ID
app.get("/child-name/:childId", async (req, res) => {
  try {
    const { childId } = req.params;
    const child = await ChildModel.findOne({ 
      childId: { $regex: new RegExp(`^${childId}$`, 'i') }
    });
    
    if (!child) {
      return res.status(404).json({ error: "Child not found" });
    }
    
    res.json({ childName: child.childName });
  } catch (err) {
    console.error("Error fetching child name:", err);
    res.status(500).json({ error: "Failed to fetch child name" });
  }
});

// 8. CHECK IF PROFILE EXISTS
app.get("/check-profile/:childId", async (req, res) => {
  try {
    const { childId } = req.params;
    const profile = await StudentProfileModel.findOne({ 
      childId: { $regex: new RegExp(`^${childId}$`, 'i') }
    });
    
    res.json({ 
      exists: !!profile,
      profile: profile || null
    });
  } catch (err) {
    console.error("Error checking profile:", err);
    res.status(500).json({ error: "Failed to check profile status" });
  }
});

// 9. CREATE STUDENT PROFILE
app.post("/student-profile", async (req, res) => {
  try {
    const profileData = req.body;

    if (!profileData.childId) {
      return res.status(400).json({ 
        success: false, 
        error: "Child ID is missing. Please try logging in again." 
      });
    }

    const existingProfile = await StudentProfileModel.findOne({ 
      childId: { $regex: new RegExp(`^${profileData.childId}$`, 'i') } 
    });

    if (existingProfile) {
      return res.status(400).json({ 
        success: false, 
        error: "A profile already exists for this Student ID." 
      });
    }

    const newProfile = new StudentProfileModel(profileData);
    await newProfile.save();

    res.status(201).json({ 
      success: true, 
      message: "Student profile saved successfully!" 
    });

  } catch (err) {
    console.error("Error creating student profile:", err);

    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ success: false, error: errors.join(', ') });
    }

    if (err.code === 11000) {
      return res.status(400).json({ success: false, error: "A record with this information already exists in the database." });
    }

    res.status(500).json({ 
      success: false, 
      error: "Failed to save profile. Please check the server logs." 
    });
  }
});

// 10. GET STUDENT PROFILE BY CHILD ID
app.get("/student-profile/:childId", async (req, res) => {
  try {
    const { childId } = req.params;
    const profile = await StudentProfileModel.findOne({ 
      childId: { $regex: new RegExp(`^${childId}$`, 'i') } 
    });
    
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }
    
    res.json(profile);
  } catch (err) {
    console.error("Error fetching profile:", err);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// 11. UPDATE STUDENT PROFILE
app.put("/student-profile/:childId", async (req, res) => {
  try {
    const { childId } = req.params;
    const updateData = { ...req.body };

    delete updateData.childId;
    delete updateData._id;

    if (updateData.contactNumbers && typeof updateData.contactNumbers === 'string') {
        updateData.contactNumbers = updateData.contactNumbers.split(',').map(num => num.trim());
    }

    const updatedProfile = await StudentProfileModel.findOneAndUpdate(
      { childId: { $regex: new RegExp(`^${childId}$`, 'i') } },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedProfile) {
      return res.status(404).json({ success: false, error: "Profile not found" });
    }

    res.json({ success: true, message: "Profile updated successfully!", profile: updatedProfile });

  } catch (err) {
    console.error("Error updating profile:", err);
    
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ success: false, error: errors.join(', ') });
    }
    
    res.status(500).json({ success: false, error: "Failed to update profile." });
  }
});


/* ================================
   EVENT MANAGEMENT API
================================ */

// 1. CREATE NEW EVENT
app.post("/events", async (req, res) => {
  try {
    const eventData = req.body;
    
    if (eventData.registrationDeadline === "") eventData.registrationDeadline = null;
    if (eventData.maxAttendees === "") eventData.maxAttendees = null;

    const requiredFields = ['eventName', 'eventType', 'eventDate', 'eventTime', 'venue', 'organizer'];
    for (const field of requiredFields) {
      if (!eventData[field]) {
        return res.status(400).json({ success: false, error: `${field} is required` });
      }
    }

    if (eventData.status === 'Upcoming') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const eventDate = new Date(eventData.eventDate);
      eventDate.setHours(0, 0, 0, 0);
      
      if (eventDate < today) {
        return res.status(400).json({ success: false, error: "Cannot create upcoming event with past date" });
      }
    }

    if (eventData.registrationDeadline && new Date(eventData.registrationDeadline) > new Date(eventData.eventDate)) {
      return res.status(400).json({ success: false, error: "Registration deadline must be on or before the event date" });
    }

    if (!eventData.eventId) {
      const date = new Date();
      const year = date.getFullYear().toString().slice(-2);
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const count = await EventModel.countDocuments();
      eventData.eventId = `EVT${year}${month}${(count + 1).toString().padStart(4, '0')}`;
    }

    const newEvent = new EventModel(eventData);
    await newEvent.save();

    res.status(201).json({ success: true, message: "Event created successfully!", event: newEvent });

  } catch (err) {
    console.error("Error creating event:", err);
    
    if (err.code === 11000) {
      return res.status(400).json({ success: false, error: "Event ID already exists. Please use a different ID." });
    }

    if (err.name === 'ValidationError' || err.name === 'CastError') {
      const errors = err.errors ? Object.values(err.errors).map(e => e.message).join(', ') : "Invalid data format.";
      return res.status(400).json({ success: false, error: errors });
    }

    res.status(500).json({ success: false, error: "Failed to create event. Please try again." });
  }
});

// 2. GET ALL EVENTS
app.get("/events", async (req, res) => {
  try {
    const { status, type, fromDate, toDate } = req.query;
    let query = {};

    if (status) query.status = status;
    if (type) query.eventType = type;
    if (fromDate || toDate) {
      query.eventDate = {};
      if (fromDate) query.eventDate.$gte = new Date(fromDate);
      if (toDate) query.eventDate.$lte = new Date(toDate);
    }

    const events = await EventModel.find(query).sort({ eventDate: -1 });
    res.json(events);

  } catch (err) {
    console.error("Error fetching events:", err);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// 3. GET TODAY'S EVENTS
app.get("/events/today/list", async (req, res) => {
  try {
    await EventModel.updateAllStatuses();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const events = await EventModel.find({
      eventDate: {
        $gte: today,
        $lt: tomorrow
      }
    }).sort({ eventTime: 1 });

    res.json(events);

  } catch (err) {
    console.error("Error fetching today's events:", err);
    res.status(500).json({ error: "Failed to fetch today's events" });
  }
});

// 4. GET UPCOMING EVENTS
app.get("/events/upcoming/list", async (req, res) => {
  try {
    await EventModel.updateAllStatuses();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const events = await EventModel.find({
      eventDate: { $gte: tomorrow }, 
      status: { $in: ["Upcoming"] }
    }).sort({ eventDate: 1, eventTime: 1 });

    res.json(events);

  } catch (err) {
    console.error("Error fetching upcoming events:", err);
    res.status(500).json({ error: "Failed to fetch upcoming events" });
  }
});

// 5. GET PAST EVENTS
app.get("/events/past/list", async (req, res) => {
  try {
    await EventModel.updateAllStatuses();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const events = await EventModel.find({
      eventDate: { $lt: today },
      status: "Completed"
    }).sort({ eventDate: -1 });

    res.json(events);

  } catch (err) {
    console.error("Error fetching past events:", err);
    res.status(500).json({ error: "Failed to fetch past events" });
  }
});

// 6. GET EVENTS STATISTICS
app.get("/events/stats/summary", async (req, res) => {
  try {
    await EventModel.updateAllStatuses();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalCount,
      upcomingCount,
      todayCount,
      pastCount,
      ongoingCount
    ] = await Promise.all([
      EventModel.countDocuments(),
      EventModel.countDocuments({ 
        eventDate: { $gte: tomorrow },
        status: "Upcoming"
      }),
      EventModel.countDocuments({
        eventDate: {
          $gte: today,
          $lt: tomorrow
        }
      }),
      EventModel.countDocuments({ 
        eventDate: { $lt: today },
        status: "Completed"
      }),
      EventModel.countDocuments({ 
        eventDate: {
          $gte: today,
          $lt: tomorrow
        },
        status: "Ongoing"
      })
    ]);

    res.json({
      total: totalCount,
      upcoming: upcomingCount,
      today: todayCount,
      past: pastCount,
      ongoing: ongoingCount
    });

  } catch (err) {
    console.error("Error fetching event stats:", err);
    res.status(500).json({ error: "Failed to fetch event statistics" });
  }
});

// 7. GET EVENT BY ID 
app.get("/events/:eventId", async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await EventModel.findOne({ 
      eventId: { $regex: new RegExp(`^${eventId}$`, 'i') }
    });

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    res.json(event);

  } catch (err) {
    console.error("Error fetching event:", err);
    res.status(500).json({ error: "Failed to fetch event" });
  }
});

// 8. UPDATE EVENT
app.put("/events/:eventId", async (req, res) => {
  try {
    const { eventId } = req.params;
    const updateData = req.body;
    
    if (updateData.status === 'Upcoming' && updateData.eventDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const eventDate = new Date(updateData.eventDate);
      eventDate.setHours(0, 0, 0, 0);
      
      if (eventDate < today) {
        return res.status(400).json({ success: false, error: "Cannot set upcoming event with past date" });
      }
    }

    if (updateData.registrationDeadline && updateData.eventDate) {
      if (new Date(updateData.registrationDeadline) > new Date(updateData.eventDate)) {
        return res.status(400).json({ success: false, error: "Registration deadline must be on or before the event date" });
      }
    }

    updateData.updatedAt = new Date();

    const updatedEvent = await EventModel.findOneAndUpdate(
      { eventId: { $regex: new RegExp(`^${eventId}$`, 'i') } },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedEvent) {
      return res.status(404).json({ success: false, error: "Event not found" });
    }

    res.json({ success: true, message: "Event updated successfully!", event: updatedEvent });

  } catch (err) {
    console.error("Error updating event:", err);
    res.status(500).json({ success: false, error: "Failed to update event" });
  }
});

// 9. DELETE EVENT
app.delete("/events/:eventId", async (req, res) => {
  try {
    const { eventId } = req.params;
    const deletedEvent = await EventModel.findOneAndDelete({ 
      eventId: { $regex: new RegExp(`^${eventId}$`, 'i') }
    });

    if (!deletedEvent) {
      return res.status(404).json({ success: false, error: "Event not found" });
    }

    res.json({ success: true, message: "Event deleted successfully!" });

  } catch (err) {
    console.error("Error deleting event:", err);
    res.status(500).json({ success: false, error: "Failed to delete event" });
  }
});


/* ================================
   TEACHER MANAGEMENT API
================================ */

// 1. CREATE NEW TEACHER
app.post("/teachers", async (req, res) => {
  try {
    const teacherData = req.body;
    
    const requiredFields = ['teacherName', 'email', 'phoneNumber', 'dateOfBirth', 'gender', 
                            'address', 'qualification', 'specialization', 'experience', 
                            'employmentType', 'emergencyContact', 'username', 'password'];
    
    for (const field of requiredFields) {
      if (!teacherData[field]) {
        return res.status(400).json({ success: false, error: `${field} is required` });
      }
    }

    const existingUsername = await TeacherModel.findOne({ username: teacherData.username.toLowerCase() });
    if (existingUsername) {
      return res.status(400).json({ success: false, error: "Username already exists. Please choose a different username." });
    }

    const existingEmail = await TeacherModel.findOne({ email: teacherData.email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({ success: false, error: "Email already exists. Please use a different email." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(teacherData.password, salt);
    teacherData.password = hashedPassword;

    if (!teacherData.teacherId) {
      const date = new Date();
      const year = date.getFullYear().toString().slice(-2);
      const count = await TeacherModel.countDocuments();
      teacherData.teacherId = `TCH${year}${(count + 1).toString().padStart(4, '0')}`;
    }

    if (!teacherData.assignedClasses) teacherData.assignedClasses = [];
    if (!teacherData.primaryClass) teacherData.primaryClass = { className: "", section: "" };

    const newTeacher = new TeacherModel(teacherData);
    await newTeacher.save();

    const teacherResponse = newTeacher.toObject();
    delete teacherResponse.password;

    res.status(201).json({ success: true, message: "Teacher created successfully!", teacher: teacherResponse });

  } catch (err) {
    console.error("Error creating teacher:", err);
    
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({ success: false, error: `${field} already exists. Please use a different ${field}.` });
    }

    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ success: false, error: errors.join(', ') });
    }

    res.status(500).json({ success: false, error: "Failed to create teacher. Please try again." });
  }
});

// 2. GET ALL TEACHERS
app.get("/teachers", async (req, res) => {
  try {
    const { status, class: assignedClass } = req.query;
    let query = {};

    if (status) query.status = status;
    if (assignedClass) query["assignedClasses.className"] = assignedClass;

    const teachers = await TeacherModel.find(query)
      .select('-password')
      .sort({ createdAt: -1 });

    res.json(teachers);

  } catch (err) {
    console.error("Error fetching teachers:", err);
    res.status(500).json({ error: "Failed to fetch teachers data" });
  }
});

// 3. GET TEACHER STATISTICS
app.get("/teachers/stats/summary", async (req, res) => {
  try {
    const [
      totalTeachers, activeTeachers, onLeaveTeachers, lkgTeachers,
      ukgTeachers, daycareTeachers, nurseryTeachers, classTeachers
    ] = await Promise.all([
      TeacherModel.countDocuments(),
      TeacherModel.countDocuments({ status: "Active" }),
      TeacherModel.countDocuments({ status: "On Leave" }),
      TeacherModel.countDocuments({ "assignedClasses.className": "LKG" }),
      TeacherModel.countDocuments({ "assignedClasses.className": "UKG" }),
      TeacherModel.countDocuments({ "assignedClasses.className": "Daycare" }),
      TeacherModel.countDocuments({ "assignedClasses.className": "Nursery" }),
      TeacherModel.countDocuments({ "assignedClasses.isClassTeacher": true })
    ]);

    const allTeachers = await TeacherModel.find({}, { assignedClasses: 1 });
    const notAssignedTeachers = allTeachers.filter(t => !t.assignedClasses || t.assignedClasses.length === 0).length;

    res.json({
      total: totalTeachers,
      active: activeTeachers,
      onLeave: onLeaveTeachers,
      byClass: {
        lkg: lkgTeachers, ukg: ukgTeachers, daycare: daycareTeachers,
        nursery: nurseryTeachers, notAssigned: notAssignedTeachers
      },
      classTeachers: classTeachers
    });

  } catch (err) {
    console.error("Error fetching teacher stats:", err);
    res.status(500).json({ error: "Failed to fetch teacher statistics" });
  }
});

// 4. GET CLASS SUMMARY
app.get("/teachers/class-summary", async (req, res) => {
  try {
    const classes = ["LKG", "UKG", "Daycare", "Nursery"];
    const summary = [];

    for (const className of classes) {
      const teachers = await TeacherModel.find({
        "assignedClasses.className": className,
        status: "Active"
      }).select('teacherName assignedClasses');

      const classTeachers = teachers.filter(t => 
        t.assignedClasses.some(c => c.className === className && c.isClassTeacher)
      );

      const sections = {};
      teachers.forEach(teacher => {
        teacher.assignedClasses
          .filter(c => c.className === className)
          .forEach(c => {
            const section = c.section || 'No Section';
            if (!sections[section]) {
              sections[section] = { teachers: [], classTeacher: null };
            }
            sections[section].teachers.push(teacher.teacherName);
            if (c.isClassTeacher) {
              sections[section].classTeacher = teacher.teacherName;
            }
          });
      });

      summary.push({
        className,
        totalTeachers: teachers.length,
        classTeachers: classTeachers.length,
        sections: Object.keys(sections).map(key => ({
          section: key,
          teacherCount: sections[key].teachers.length,
          teachers: sections[key].teachers,
          classTeacher: sections[key].classTeacher || 'Not assigned'
        }))
      });
    }

    res.json({ success: true, summary });

  } catch (err) {
    console.error("Error fetching class summary:", err);
    res.status(500).json({ error: "Failed to fetch class summary" });
  }
});

// 5. GET TEACHERS BY CLASS
app.get("/teachers/class/:className", async (req, res) => {
  try {
    const { className } = req.params;
    const { section } = req.query;
    
    let query = {
      "assignedClasses.className": className,
      status: "Active"
    };
    
    if (section) query["assignedClasses.section"] = section;

    const teachers = await TeacherModel.find(query).select('-password');

    const classTeacherQuery = {
      "assignedClasses.className": className,
      "assignedClasses.isClassTeacher": true,
      status: "Active"
    };
    
    if (section) classTeacherQuery["assignedClasses.section"] = section;

    const classTeachers = await TeacherModel.find(classTeacherQuery).select('-password');

    res.json({
      success: true, teachers, classTeachers,
      totalCount: teachers.length, classTeacherCount: classTeachers.length
    });

  } catch (err) {
    console.error("Error fetching teachers by class:", err);
    res.status(500).json({ error: "Failed to fetch teachers" });
  }
});

// 6. BULK ASSIGN TEACHERS TO CLASS
app.post("/teachers/bulk-assign", async (req, res) => {
  try {
    const { className, section, teacherIds, isClassTeacher } = req.body;

    if (!className || !teacherIds || !Array.isArray(teacherIds)) {
      return res.status(400).json({ success: false, error: "Class name and teacher IDs array are required" });
    }

    const academicYear = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
    const results = [];

    for (const teacherId of teacherIds) {
      try {
        const teacher = await TeacherModel.findOne({ 
          teacherId: { $regex: new RegExp(`^${teacherId}$`, 'i') }
        });

        if (teacher) {
          const alreadyAssigned = teacher.assignedClasses?.some(c => 
            c.className === className && c.section === (section || "")
          );
          
          if (!alreadyAssigned) {
            if (!teacher.assignedClasses) teacher.assignedClasses = [];
            
            teacher.assignedClasses.push({
              className, section: section || "", isClassTeacher: isClassTeacher || false,
              assignedDate: new Date(), academicYear
            });

            if (teacher.assignedClasses.length === 1) {
              teacher.primaryClass = { className, section: section || "" };
            }

            await teacher.save();
            results.push({ teacherId: teacher.teacherId, teacherName: teacher.teacherName, success: true, message: "Assigned successfully" });
          } else {
            results.push({ teacherId: teacher.teacherId, teacherName: teacher.teacherName, success: false, message: "Already assigned to this class" });
          }
        } else {
          results.push({ teacherId, success: false, message: "Teacher not found" });
        }
      } catch (err) {
        results.push({ teacherId, success: false, message: "Error assigning teacher" });
      }
    }

    res.json({ success: true, message: "Bulk assignment completed", results });

  } catch (err) {
    console.error("Error in bulk assignment:", err);
    res.status(500).json({ success: false, error: "Failed to perform bulk assignment" });
  }
});

// 7. GET TEACHER BY ID
app.get("/teachers/:teacherId", async (req, res) => {
  try {
    const { teacherId } = req.params;
    const teacher = await TeacherModel.findOne({ 
      teacherId: { $regex: new RegExp(`^${teacherId}$`, 'i') }
    }).select('-password');

    if (!teacher) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    res.json(teacher);

  } catch (err) {
    console.error("Error fetching teacher:", err);
    res.status(500).json({ error: "Failed to fetch teacher" });
  }
});

// 8. UPDATE TEACHER
app.put("/teachers/:teacherId", async (req, res) => {
  try {
    const { teacherId } = req.params;
    const updateData = { ...req.body };

    delete updateData.teacherId; delete updateData._id;
    delete updateData.password; delete updateData.createdBy;

    if (updateData.username) {
      const existingTeacher = await TeacherModel.findOne({
        username: updateData.username.toLowerCase(),
        teacherId: { $ne: teacherId }
      });
      if (existingTeacher) return res.status(400).json({ success: false, error: "Username already exists." });
    }

    if (updateData.email) {
      const existingTeacher = await TeacherModel.findOne({
        email: updateData.email.toLowerCase(),
        teacherId: { $ne: teacherId }
      });
      if (existingTeacher) return res.status(400).json({ success: false, error: "Email already exists." });
    }

    const updatedTeacher = await TeacherModel.findOneAndUpdate(
      { teacherId: { $regex: new RegExp(`^${teacherId}$`, 'i') } },
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedTeacher) {
      return res.status(404).json({ success: false, error: "Teacher not found" });
    }

    res.json({ success: true, message: "Teacher updated successfully!", teacher: updatedTeacher });

  } catch (err) {
    console.error("Error updating teacher:", err);
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ success: false, error: errors.join(', ') });
    }
    res.status(500).json({ success: false, error: "Failed to update teacher" });
  }
});

// 9. DELETE TEACHER
app.delete("/teachers/:teacherId", async (req, res) => {
  try {
    const { teacherId } = req.params;
    const deletedTeacher = await TeacherModel.findOneAndDelete({ 
      teacherId: { $regex: new RegExp(`^${teacherId}$`, 'i') }
    });

    if (!deletedTeacher) return res.status(404).json({ success: false, error: "Teacher not found" });

    res.json({ success: true, message: "Teacher deleted successfully!" });

  } catch (err) {
    console.error("Error deleting teacher:", err);
    res.status(500).json({ success: false, error: "Failed to delete teacher" });
  }
});

// 10. ASSIGN CLASSES TO TEACHER
app.post("/teachers/:teacherId/assign-classes", async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { classes } = req.body;

    if (!classes || !Array.isArray(classes)) {
      return res.status(400).json({ success: false, error: "Classes array is required" });
    }

    const teacher = await TeacherModel.findOne({ 
      teacherId: { $regex: new RegExp(`^${teacherId}$`, 'i') }
    });

    if (!teacher) return res.status(404).json({ success: false, error: "Teacher not found" });

    const classTeacherCount = classes.filter(c => c.isClassTeacher).length;
    if (classTeacherCount > 1) {
      return res.status(400).json({ success: false, error: "Teacher can only be class teacher for one class" });
    }

    teacher.assignedClasses = classes.map(c => ({
      className: c.className, section: c.section || "", isClassTeacher: c.isClassTeacher || false,
      assignedDate: new Date(), academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`
    }));

    const primaryClass = classes.find(c => c.isClassTeacher) || classes[0];
    if (primaryClass) {
      teacher.primaryClass = { className: primaryClass.className, section: primaryClass.section || "" };
    } else {
      teacher.primaryClass = { className: "", section: "" };
    }

    await teacher.save();

    const teacherResponse = teacher.toObject();
    delete teacherResponse.password;

    res.json({ success: true, message: "Classes assigned successfully!", teacher: teacherResponse });

  } catch (err) {
    console.error("Error assigning classes:", err);
    res.status(500).json({ success: false, error: "Failed to assign classes" });
  }
});

// 11. REMOVE TEACHER FROM CLASS
app.delete("/teachers/:teacherId/classes/:className", async (req, res) => {
  try {
    const { teacherId, className } = req.params;
    const { section } = req.query;

    const teacher = await TeacherModel.findOne({ 
      teacherId: { $regex: new RegExp(`^${teacherId}$`, 'i') }
    });

    if (!teacher) return res.status(404).json({ success: false, error: "Teacher not found" });

    teacher.assignedClasses = (teacher.assignedClasses || []).filter(c => 
      !(c.className === className && (!section || c.section === section))
    );

    if (teacher.primaryClass?.className === className && (!section || teacher.primaryClass?.section === section)) {
      teacher.primaryClass = teacher.assignedClasses[0] || { className: "", section: "" };
    }

    await teacher.save();

    const teacherResponse = teacher.toObject();
    delete teacherResponse.password;

    res.json({ success: true, message: "Teacher removed from class successfully!", teacher: teacherResponse });

  } catch (err) {
    console.error("Error removing teacher from class:", err);
    res.status(500).json({ success: false, error: "Failed to remove teacher from class" });
  }
});

// 12. UPDATE TEACHER'S CLASS ROLE
app.patch("/teachers/:teacherId/classes/:className/role", async (req, res) => {
  try {
    const { teacherId, className } = req.params;
    const { section, isClassTeacher } = req.body;

    const teacher = await TeacherModel.findOne({ 
      teacherId: { $regex: new RegExp(`^${teacherId}$`, 'i') }
    });

    if (!teacher) return res.status(404).json({ success: false, error: "Teacher not found" });

    const classIndex = (teacher.assignedClasses || []).findIndex(c => 
      c.className === className && (!section || c.section === section)
    );

    if (classIndex === -1) {
      return res.status(404).json({ success: false, error: "Teacher not assigned to this class" });
    }

    if (isClassTeacher) {
      teacher.assignedClasses.forEach((c, index) => {
        if (index !== classIndex) c.isClassTeacher = false;
      });
      teacher.primaryClass = { className, section: teacher.assignedClasses[classIndex].section || "" };
    }

    teacher.assignedClasses[classIndex].isClassTeacher = isClassTeacher;
    await teacher.save();

    const teacherResponse = teacher.toObject();
    delete teacherResponse.password;

    res.json({ success: true, message: `Teacher ${isClassTeacher ? 'set as' : 'removed as'} class teacher successfully`, teacher: teacherResponse });

  } catch (err) {
    console.error("Error updating teacher role:", err);
    res.status(500).json({ success: false, error: "Failed to update teacher role" });
  }
});

// 13. UPDATE TEACHER STATUS
app.patch("/teachers/:teacherId/status", async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { status } = req.body;

    if (!status || !["Active", "On Leave", "Resigned", "Terminated", "Probation"].includes(status)) {
      return res.status(400).json({ success: false, error: "Valid status is required" });
    }

    const updatedTeacher = await TeacherModel.findOneAndUpdate(
      { teacherId: { $regex: new RegExp(`^${teacherId}$`, 'i') } },
      { $set: { status } },
      { new: true }
    ).select('-password');

    if (!updatedTeacher) return res.status(404).json({ success: false, error: "Teacher not found" });

    res.json({ success: true, message: "Teacher status updated successfully!", teacher: updatedTeacher });

  } catch (err) {
    console.error("Error updating teacher status:", err);
    res.status(500).json({ success: false, error: "Failed to update teacher status" });
  }
});

// 14. TEACHER LOGIN
app.post("/teacher-login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    const teacher = await TeacherModel.findOne({ username: username.toLowerCase() });

    if (!teacher) return res.status(401).json({ error: "Invalid username or password" });

    const isMatch = await bcrypt.compare(password, teacher.password);
    
    if (!isMatch) return res.status(401).json({ error: "Invalid username or password" });

    const loginTime = new Date();
    await TeacherModel.updateOne({ _id: teacher._id }, { $set: { lastLogin: loginTime } });

    const teacherResponse = teacher.toObject();
    delete teacherResponse.password;

    res.json({ success: true, message: "Login successful", teacher: teacherResponse, lastLogin: loginTime });

  } catch (err) {
    console.error("Teacher login error:", err);
    res.status(500).json({ error: "Server error during login. Please try again." });
  }
});


/* ================================
   DAYCARE MANAGEMENT API
================================ */

// 1. Get eligible students for Daycare
app.get("/daycare/eligible", async (req, res) => {
  try {
    const eligibleStudents = await StudentProfileModel.find({
      $or: [
        { class: "Daycare" },
        { includeDaycare: true }
      ]
    }).select('childId fullName profilePhoto class includeDaycare');

    res.json(eligibleStudents);
  } catch (err) {
    console.error("Error fetching eligible daycare students:", err);
    res.status(500).json({ error: "Failed to fetch eligible students" });
  }
});

// 2. Get TODAY'S daycare list
app.get("/daycare/today", async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaysList = await DaycareAttendanceModel.find({ date: today }).sort({ addedAt: 1 });
    res.json(todaysList);
  } catch (err) {
    console.error("Error fetching today's daycare list:", err);
    res.status(500).json({ error: "Failed to fetch today's list" });
  }
});

// 3. Add student to Daycare for today
app.post("/daycare/add", async (req, res) => {
  try {
    const { childId, childName } = req.body;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const currentCount = await DaycareAttendanceModel.countDocuments({ date: today });
    if (currentCount >= 5) {
      return res.status(400).json({ success: false, error: "Daycare limit reached! You can only add 5 students per day." });
    }

    const alreadyAdded = await DaycareAttendanceModel.findOne({ childId: childId, date: today });
    if (alreadyAdded) {
      return res.status(400).json({ success: false, error: `${childName} is already added to today's list.` });
    }

    const profile = await StudentProfileModel.findOne({ childId: childId });
    if (!profile || (profile.class !== "Daycare" && !profile.includeDaycare)) {
      return res.status(400).json({ success: false, error: "This student is not registered for Daycare facilities." });
    }

    const newEntry = new DaycareAttendanceModel({
      childId: childId,
      childName: childName,
      date: today 
    });

    await newEntry.save();
    
    res.status(201).json({ success: true, message: `${childName} added successfully!`, entry: newEntry });

  } catch (err) {
    console.error("Error adding to daycare:", err);
    res.status(500).json({ success: false, error: "Failed to add student to daycare." });
  }
});


/* ================================
   EVENT PHOTO MANAGEMENT API
================================ */

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "uploads/event-photos");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    cb(null, "event-" + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter
});

// 1. UPLOAD EVENT PHOTOS
app.post("/event-photos/upload", upload.array("photos", 20), async (req, res) => {
  try {
    const { eventId, eventName, photoCaption, tags } = req.body;
    const files = req.files;

    if (!eventId) {
      return res.status(400).json({ success: false, error: "Event ID is required" });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: "At least one photo is required" });
    }

    const uploadedPhotos = [];
    
    for (const file of files) {
      const photoUrl = `${req.protocol}://${req.get("host")}/uploads/event-photos/${file.filename}`;
      
      const photoData = {
        eventId: eventId,
        eventName: eventName || "Event",
        photoUrl: photoUrl,
        photoCaption: photoCaption || "",
        uploadedBy: req.body.uploadedBy || "ADMIN",
        uploadedByName: req.body.uploadedByName || "Admin",
        photoSize: file.size,
        photoType: file.mimetype,
        tags: tags ? tags.split(",").map(tag => tag.trim()) : []
      };
      
      const newPhoto = new EventPhotoModel(photoData);
      await newPhoto.save();
      uploadedPhotos.push(newPhoto);
    }

    res.json({
      success: true,
      message: `Successfully uploaded ${uploadedPhotos.length} photos`,
      uploadedCount: uploadedPhotos.length,
      photos: uploadedPhotos
    });

  } catch (err) {
    console.error("Error uploading photos:", err);
    res.status(500).json({ success: false, error: "Failed to upload photos" });
  }
});

// 2. GET ALL EVENT PHOTOS
app.get("/event-photos", async (req, res) => {
  try {
    const { eventId, limit = 50, featured } = req.query;
    let query = { status: "Active" };
    
    if (eventId) query.eventId = eventId;
    if (featured === "true") query.isFeatured = true;
    
    const photos = await EventPhotoModel.find(query)
      .sort({ uploadedAt: -1 })
      .limit(parseInt(limit));
    
    res.json(photos);
  } catch (err) {
    console.error("Error fetching photos:", err);
    res.status(500).json({ error: "Failed to fetch photos" });
  }
});

// 3. GET PHOTOS BY EVENT
app.get("/event-photos/event/:eventId", async (req, res) => {
  try {
    const { eventId } = req.params;
    const photos = await EventPhotoModel.find({ 
      eventId: { $regex: new RegExp(`^${eventId}$`, 'i') },
      status: "Active"
    }).sort({ isFeatured: -1, uploadedAt: -1 });
    
    res.json(photos);
  } catch (err) {
    console.error("Error fetching event photos:", err);
    res.status(500).json({ error: "Failed to fetch event photos" });
  }
});

// 4. DELETE PHOTO
app.delete("/event-photos/:photoId", async (req, res) => {
  try {
    const { photoId } = req.params;
    
    const photo = await EventPhotoModel.findOne({ photoId: photoId });
    if (!photo) {
      return res.status(404).json({ success: false, error: "Photo not found" });
    }
    
    const filePath = path.join(__dirname, "uploads/event-photos", path.basename(photo.photoUrl));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    photo.status = "Deleted";
    await photo.save();
    
    res.json({ success: true, message: "Photo deleted successfully" });
  } catch (err) {
    console.error("Error deleting photo:", err);
    res.status(500).json({ success: false, error: "Failed to delete photo" });
  }
});

// 5. SET FEATURED PHOTO
app.patch("/event-photos/:photoId/featured", async (req, res) => {
  try {
    const { photoId } = req.params;
    
    const photo = await EventPhotoModel.findOne({ photoId: photoId });
    if (!photo) {
      return res.status(404).json({ success: false, error: "Photo not found" });
    }
    
    await EventPhotoModel.updateMany(
      { eventId: photo.eventId },
      { $set: { isFeatured: false } }
    );
    
    photo.isFeatured = true;
    await photo.save();
    
    res.json({ success: true, message: "Photo set as featured" });
  } catch (err) {
    console.error("Error setting featured photo:", err);
    res.status(500).json({ success: false, error: "Failed to set featured photo" });
  }
});

// 6. UPDATE PHOTO CAPTION
app.patch("/event-photos/:photoId/caption", async (req, res) => {
  try {
    const { photoId } = req.params;
    const { caption, tags } = req.body;
    
    const updateData = {};
    if (caption !== undefined) updateData.photoCaption = caption;
    if (tags !== undefined) updateData.tags = tags.split(",").map(tag => tag.trim());
    
    const updatedPhoto = await EventPhotoModel.findOneAndUpdate(
      { photoId: photoId },
      { $set: updateData },
      { new: true }
    );
    
    if (!updatedPhoto) {
      return res.status(404).json({ success: false, error: "Photo not found" });
    }
    
    res.json({ success: true, message: "Photo updated successfully", photo: updatedPhoto });
  } catch (err) {
    console.error("Error updating photo:", err);
    res.status(500).json({ success: false, error: "Failed to update photo" });
  }
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* ================================
   MESSAGE MANAGEMENT API
================================ */

const MessageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, trim: true, lowercase: true },
  messageType: { type: String, enum: ['general', 'feedback', 'suggestion', 'complaint'], default: 'general' },
  subject: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  rating: { type: Number, min: 1, max: 5 },
  isAnonymous: { type: Boolean, default: false },
  status: { type: String, enum: ['pending', 'reviewed', 'resolved', 'replied'], default: 'pending' },
  reply: { type: String, default: null },
  repliedBy: { type: String, default: null },
  repliedAt: { type: Date, default: null },
  ipAddress: { type: String, default: null }
}, { timestamps: true });

const Message = mongoose.model('Message', MessageSchema);

// 1. Create a new message
app.post('/messages', async (req, res) => {
  try {
    const { name, email, messageType, subject, message, rating, isAnonymous, ipAddress } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ success: false, error: 'Subject and message are required' });
    }

    const newMessage = new Message({
      name: isAnonymous ? 'Anonymous' : name,
      email: email || null,
      messageType: messageType || 'general',
      subject, message,
      rating: rating || null,
      isAnonymous: isAnonymous || false,
      ipAddress: ipAddress || null
    });

    await newMessage.save();

    res.status(201).json({ 
      success: true, 
      message: 'Message sent successfully!',
      data: newMessage
    });

  } catch (err) {
    console.error('Error creating message:', err);
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
});

// 2. Get all messages (Admin only)
app.get('/messages', async (req, res) => {
  try {
    const { status, messageType } = req.query;
    let query = {};

    if (status) query.status = status;
    if (messageType) query.messageType = messageType;

    const messages = await Message.find(query).sort({ createdAt: -1 });
    res.json(messages);
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// 3. Get a single message by ID
app.get('/messages/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json(message);
  } catch (err) {
    console.error('Error fetching message:', err);
    res.status(500).json({ error: 'Failed to fetch message' });
  }
});

// 4. Reply to a message
app.post('/messages/:messageId/reply', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { reply, repliedBy } = req.body;

    if (!reply) {
      return res.status(400).json({ success: false, error: 'Reply message is required' });
    }

    const updatedMessage = await Message.findByIdAndUpdate(
      messageId,
      { $set: { reply: reply, repliedBy: repliedBy || 'Admin', repliedAt: new Date(), status: 'replied' } },
      { new: true }
    );

    if (!updatedMessage) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    res.json({ 
      success: true, 
      message: 'Reply sent successfully!',
      data: updatedMessage
    });
  } catch (err) {
    console.error('Error replying to message:', err);
    res.status(500).json({ success: false, error: 'Failed to send reply' });
  }
});

// 5. Update message status
app.patch('/messages/:messageId/status', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { status } = req.body;

    if (!status || !['pending', 'reviewed', 'resolved', 'replied'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const updatedMessage = await Message.findByIdAndUpdate(
      messageId, { $set: { status } }, { new: true }
    );

    if (!updatedMessage) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    res.json({ 
      success: true, 
      message: `Message marked as ${status}`,
      data: updatedMessage
    });
  } catch (err) {
    console.error('Error updating message status:', err);
    res.status(500).json({ success: false, error: 'Failed to update status' });
  }
});

// 6. Delete a message
app.delete('/messages/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const deletedMessage = await Message.findByIdAndDelete(messageId);

    if (!deletedMessage) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    res.json({ success: true, message: 'Message deleted successfully' });
  } catch (err) {
    console.error('Error deleting message:', err);
    res.status(500).json({ success: false, error: 'Failed to delete message' });
  }
});

// 7. Get message statistics
app.get('/messages/stats/summary', async (req, res) => {
  try {
    const [
      total, pending, reviewed, resolved, replied, feedback, suggestions, complaints
    ] = await Promise.all([
      Message.countDocuments(),
      Message.countDocuments({ status: 'pending' }),
      Message.countDocuments({ status: 'reviewed' }),
      Message.countDocuments({ status: 'resolved' }),
      Message.countDocuments({ status: 'replied' }),
      Message.countDocuments({ messageType: 'feedback' }),
      Message.countDocuments({ messageType: 'suggestion' }),
      Message.countDocuments({ messageType: 'complaint' })
    ]);

    res.json({
      total, pending, reviewed, resolved, replied,
      byType: {
        feedback, suggestions, complaints,
        general: total - (feedback + suggestions + complaints)
      }
    });
  } catch (err) {
    console.error('Error fetching message stats:', err);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

/* ================================
   Attendance MANAGEMENT API
================================ */
// Import Attendance model


// 1. SAVE ATTENDANCE RECORDS
app.post("/attendance/save", async (req, res) => {
  try {
    const { date, attendanceRecords } = req.body;
    
    if (!date || !attendanceRecords || !Array.isArray(attendanceRecords)) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid request: date and attendanceRecords array are required" 
      });
    }
    
    const savedRecords = [];
    const errors = [];
    
    for (const record of attendanceRecords) {
      try {
        // Check if attendance already exists for this child on this date
        const existingAttendance = await Attendance.findOne({
          date: date,
          childId: record.childId
        });
        
        if (existingAttendance) {
          // Update existing record
          existingAttendance.scanCount += record.scanCount;
          existingAttendance.allScanTimes.push(...record.allScanTimes);
          existingAttendance.firstScanTime = record.firstScanTime;
          
          // REMOVED manual updatedAt line here! Mongoose handles it now.
          await existingAttendance.save();
          
          savedRecords.push(existingAttendance);
        } else {
          // Create new record
          const newAttendance = new Attendance({
            date: date,
            childId: record.childId,
            childName: record.childName,
            firstScanTime: record.firstScanTime,
            scanCount: record.scanCount,
            attendanceStatus: record.attendanceStatus || "Present",
            allScanTimes: record.allScanTimes || [{ time: record.firstScanTime, timestamp: new Date() }]
          });
          
          await newAttendance.save();
          savedRecords.push(newAttendance);
        }
      } catch (err) {
        console.error("Error saving record:", err);
        errors.push({ childId: record.childId, error: err.message });
      }
    }
    
    res.json({
      success: true,
      message: `Successfully saved ${savedRecords.length} attendance records`,
      savedCount: savedRecords.length,
      errors: errors.length > 0 ? errors : undefined,
      records: savedRecords
    });
    
  } catch (err) {
    console.error("Error saving attendance:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to save attendance records",
      details: err.message 
    });
  }
});

// 2. GET ATTENDANCE HISTORY
app.get("/attendance/history", async (req, res) => {
  try {
    const { startDate, endDate, childId, limit = 100 } = req.query;
    let query = {};
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }
    
    if (childId) query.childId = childId;
    
    const attendance = await Attendance.find(query)
      .sort({ date: -1, childName: 1 })
      .limit(parseInt(limit));
    
    res.json({
      success: true,
      total: attendance.length,
      attendance: attendance
    });
    
  } catch (err) {
    console.error("Error fetching attendance history:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch attendance history" 
    });
  }
});

// 3. GET ATTENDANCE BY DATE
app.get("/attendance/date/:date", async (req, res) => {
  try {
    const { date } = req.params;
    
    const attendance = await Attendance.find({ date: date })
      .sort({ childName: 1 });
    
    res.json({
      success: true,
      date: date,
      total: attendance.length,
      attendance: attendance
    });
    
  } catch (err) {
    console.error("Error fetching attendance by date:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch attendance" 
    });
  }
});

// 4. GET ATTENDANCE FOR STUDENT
app.get("/attendance/student/:childId", async (req, res) => {
  try {
    const { childId } = req.params;
    const { limit = 30 } = req.query;
    
    const attendance = await Attendance.find({ 
      childId: { $regex: new RegExp(`^${childId}$`, 'i') }
    })
      .sort({ date: -1 })
      .limit(parseInt(limit));
    
    // Calculate attendance statistics
    const totalDays = attendance.length;
    const presentDays = attendance.filter(a => a.attendanceStatus === "Present").length;
    const lateDays = attendance.filter(a => a.attendanceStatus === "Late").length;
    const halfDays = attendance.filter(a => a.attendanceStatus === "Half Day").length;
    
    res.json({
      success: true,
      childId: childId,
      childName: attendance[0]?.childName || "Unknown",
      statistics: {
        totalDays: totalDays,
        presentDays: presentDays,
        lateDays: lateDays,
        halfDays: halfDays,
        attendancePercentage: totalDays > 0 ? ((presentDays + lateDays + halfDays) / totalDays * 100).toFixed(2) : 0
      },
      records: attendance
    });
    
  } catch (err) {
    console.error("Error fetching student attendance:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch student attendance" 
    });
  }
});

// 5. GET MONTHLY ATTENDANCE SUMMARY
app.get("/attendance/monthly/:year/:month", async (req, res) => {
  try {
    const { year, month } = req.params;
    
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toLocaleDateString();
    
    const attendance = await Attendance.find({
      date: { $gte: startDate, $lte: endDate }
    });
    
    const summary = {
      year: parseInt(year),
      month: parseInt(month),
      monthName: new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' }),
      totalAttendanceRecords: attendance.length,
      uniqueStudents: new Set(attendance.map(a => a.childId)).size,
      attendanceByDay: {},
      studentAttendance: {}
    };
    
    attendance.forEach(record => {
      // Group by day
      if (!summary.attendanceByDay[record.date]) {
        summary.attendanceByDay[record.date] = {
          present: 0,
          late: 0,
          halfDay: 0,
          total: 0
        };
      }
      summary.attendanceByDay[record.date][record.attendanceStatus.toLowerCase()]++;
      summary.attendanceByDay[record.date].total++;
      
      // Group by student
      if (!summary.studentAttendance[record.childId]) {
        summary.studentAttendance[record.childId] = {
          childId: record.childId,
          childName: record.childName,
          daysPresent: 0,
          daysLate: 0,
          daysHalfDay: 0
        };
      }
      summary.studentAttendance[record.childId][`days${record.attendanceStatus}`]++;
    });
    
    res.json({
      success: true,
      summary: summary
    });
    
  } catch (err) {
    console.error("Error fetching monthly summary:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch monthly summary" 
    });
  }
});

// 6. UPDATE ATTENDANCE STATUS
app.patch("/attendance/:attendanceId", async (req, res) => {
  try {
    const { attendanceId } = req.params;
    const { attendanceStatus, remarks } = req.body;
    
    if (!attendanceStatus || !["Present", "Absent", "Late", "Half Day"].includes(attendanceStatus)) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid attendance status" 
      });
    }
    
    const updatedAttendance = await Attendance.findByIdAndUpdate(
      attendanceId,
      { 
        $set: { 
          attendanceStatus: attendanceStatus,
          remarks: remarks,
          updatedAt: new Date()
        } 
      },
      { new: true }
    );
    
    if (!updatedAttendance) {
      return res.status(404).json({ 
        success: false, 
        error: "Attendance record not found" 
      });
    }
    
    res.json({
      success: true,
      message: "Attendance status updated successfully",
      attendance: updatedAttendance
    });
    
  } catch (err) {
    console.error("Error updating attendance:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to update attendance status" 
    });
  }
});

// 7. DELETE ATTENDANCE RECORD
app.delete("/attendance/:attendanceId", async (req, res) => {
  try {
    const { attendanceId } = req.params;
    
    const deletedAttendance = await Attendance.findByIdAndDelete(attendanceId);
    
    if (!deletedAttendance) {
      return res.status(404).json({ 
        success: false, 
        error: "Attendance record not found" 
      });
    }
    
    res.json({
      success: true,
      message: "Attendance record deleted successfully",
      deletedRecord: deletedAttendance
    });
    
  } catch (err) {
    console.error("Error deleting attendance:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to delete attendance record" 
    });
  }
});

// 8. GET ATTENDANCE STATISTICS
app.get("/attendance/stats/overview", async (req, res) => {
  try {
    const today = new Date().toLocaleDateString();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString();
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toLocaleDateString();
    
    const [
      totalAttendance,
      todayAttendance,
      weekAttendance,
      monthAttendance,
      uniqueStudents
    ] = await Promise.all([
      Attendance.countDocuments(),
      Attendance.countDocuments({ date: today }),
      Attendance.countDocuments({ date: { $gte: weekAgo, $lte: today } }),
      Attendance.countDocuments({ date: { $gte: monthAgo, $lte: today } }),
      Attendance.distinct("childId")
    ]);
    
    res.json({
      success: true,
      statistics: {
        totalAttendanceRecords: totalAttendance,
        todayAttendance: todayAttendance,
        weeklyAttendance: weekAttendance,
        monthlyAttendance: monthAttendance,
        uniqueStudents: uniqueStudents.length,
        averageDailyAttendance: totalAttendance > 0 ? (totalAttendance / 30).toFixed(2) : 0
      }
    });
    
  } catch (err) {
    console.error("Error fetching attendance statistics:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch attendance statistics" 
    });
  }
});

// 9. EXPORT ATTENDANCE TO CSV
app.get("/attendance/export/csv", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = {};
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }
    
    const attendance = await Attendance.find(query).sort({ date: -1, childName: 1 });
    
    if (attendance.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: "No attendance data found for the selected period" 
      });
    }
    
    // Create CSV
    const headers = ["Date", "Child ID", "Child Name", "First Scan Time", "Scan Count", "Status", "School Year"];
    const csvRows = [
      headers.join(","),
      ...attendance.map(record => {
        return [
          `"${record.date}"`,
          `"${record.childId}"`,
          `"${record.childName}"`,
          `"${record.firstScanTime}"`,
          `"${record.scanCount}"`,
          `"${record.attendanceStatus}"`,
          `"${record.schoolYear}"`
        ].join(",");
      })
    ];
    
    const csvContent = csvRows.join("\n");
    const fileName = `attendance_${startDate || 'all'}_to_${endDate || 'all'}.csv`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(csvContent);
    
  } catch (err) {
    console.error("Error exporting attendance:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to export attendance data" 
    });
  }
});

/* ================================
   ADMIN STUDENT MANAGEMENT API
================================ */

// 1. GET ALL STUDENTS (Admin)
app.get("/admin/students", async (req, res) => {
  try {
    const students = await StudentProfileModel.find()
      .sort({ createdAt: -1 })
      .select('-__v');
    
    res.json({ 
      success: true, 
      students: students,
      total: students.length 
    });
  } catch (error) {
    console.error("Error fetching students:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch students" 
    });
  }
});

// 2. GET A SINGLE STUDENT BY CHILD ID (Admin)
app.get("/admin/students/:childId", async (req, res) => {
  try {
    const { childId } = req.params;
    const student = await StudentProfileModel.findOne({ 
      childId: { $regex: new RegExp(`^${childId}$`, 'i') }
    }).select('-__v');
    
    if (!student) {
      return res.status(404).json({ 
        success: false, 
        error: "Student not found" 
      });
    }
    
    res.json({ 
      success: true, 
      student: student 
    });
  } catch (error) {
    console.error("Error fetching student:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch student" 
    });
  }
});

// 3. UPDATE STUDENT PROFILE (Admin)
app.put("/admin/students/:childId", async (req, res) => {
  try {
    const { childId } = req.params;
    const updateData = { ...req.body };
    
    // Remove fields that shouldn't be updated directly
    delete updateData._id;
    delete updateData.createdAt;
    delete updateData.__v;
    
    // Validate age if provided
    if (updateData.age !== undefined) {
      const age = parseInt(updateData.age);
      if (age < 3 || age > 5) {
        return res.status(400).json({ 
          success: false, 
          error: "Child must be between 3 and 5 years old" 
        });
      }
    }
    
    // Validate class based on age
    if (updateData.age && updateData.class) {
      const age = parseInt(updateData.age);
      if (age === 3 && updateData.class !== 'Daycare') {
        return res.status(400).json({ 
          success: false, 
          error: "3-year-old children can only be in Daycare" 
        });
      }
      if (age === 4 && !['Daycare', 'LKG'].includes(updateData.class)) {
        return res.status(400).json({ 
          success: false, 
          error: "4-year-old children can only be in Daycare or LKG" 
        });
      }
      if (age === 5 && !['Daycare', 'UKG'].includes(updateData.class)) {
        return res.status(400).json({ 
          success: false, 
          error: "5-year-old children can only be in Daycare or UKG" 
        });
      }
    }
    
    // Handle contact numbers conversion
    if (updateData.contactNumbers && typeof updateData.contactNumbers === 'string') {
      updateData.contactNumbers = updateData.contactNumbers.split(',').map(num => num.trim());
    }
    
    // Validate email if provided
    if (updateData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updateData.email)) {
        return res.status(400).json({ 
          success: false, 
          error: "Please enter a valid email address" 
        });
      }
    }
    
    // Validate phone numbers if provided
    if (updateData.contactNumbers && Array.isArray(updateData.contactNumbers)) {
      const phoneRegex = /^0\d{9}$/;
      for (const phone of updateData.contactNumbers) {
        if (phone && !phoneRegex.test(phone)) {
          return res.status(400).json({ 
            success: false, 
            error: "Phone numbers must be 10 digits and start with 0" 
          });
        }
      }
    }
    
    const updatedStudent = await StudentProfileModel.findOneAndUpdate(
      { childId: { $regex: new RegExp(`^${childId}$`, 'i') } },
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-__v');
    
    if (!updatedStudent) {
      return res.status(404).json({ 
        success: false, 
        error: "Student not found" 
      });
    }
    
    res.json({ 
      success: true, 
      message: "Student profile updated successfully!", 
      student: updatedStudent 
    });
    
  } catch (error) {
    console.error("Error updating student:", error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ 
        success: false, 
        error: errors.join(', ') 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: "Failed to update student profile" 
    });
  }
});

// 4. DELETE STUDENT PROFILE (Admin)
app.delete("/admin/students/:childId", async (req, res) => {
  try {
    const { childId } = req.params;
    
    // Find and delete the student profile
    const deletedStudent = await StudentProfileModel.findOneAndDelete({ 
      childId: { $regex: new RegExp(`^${childId}$`, 'i') }
    });
    
    if (!deletedStudent) {
      return res.status(404).json({ 
        success: false, 
        error: "Student not found" 
      });
    }
    
    // Optional: Also delete associated attendance records
    await Attendance.deleteMany({ 
      childId: { $regex: new RegExp(`^${childId}$`, 'i') }
    });
    
    // Optional: Also delete daycare attendance records
    await DaycareAttendanceModel.deleteMany({ 
      childId: { $regex: new RegExp(`^${childId}$`, 'i') }
    });
    
    res.json({ 
      success: true, 
      message: "Student profile deleted successfully!",
      deletedStudent: {
        childId: deletedStudent.childId,
        fullName: deletedStudent.fullName
      }
    });
    
  } catch (error) {
    console.error("Error deleting student:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to delete student profile" 
    });
  }
});

// 5. SEARCH STUDENTS (Admin)
app.get("/admin/students/search/:query", async (req, res) => {
  try {
    const { query } = req.params;
    const students = await StudentProfileModel.find({
      $or: [
        { fullName: { $regex: query, $options: 'i' } },
        { childId: { $regex: query, $options: 'i' } },
        { guardianName: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ]
    }).sort({ createdAt: -1 });
    
    res.json({ 
      success: true, 
      students: students,
      total: students.length 
    });
  } catch (error) {
    console.error("Error searching students:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to search students" 
    });
  }
});

// 6. GET STUDENTS BY CLASS (Admin)
app.get("/admin/students/class/:className", async (req, res) => {
  try {
    const { className } = req.params;
    const { includeDaycare } = req.query;
    
    let query = { class: className };
    
    // Filter by daycare inclusion if specified
    if (includeDaycare !== undefined) {
      query.includeDaycare = includeDaycare === 'true';
    }
    
    const students = await StudentProfileModel.find(query).sort({ fullName: 1 });
    
    res.json({ 
      success: true, 
      students: students,
      total: students.length,
      className: className
    });
  } catch (error) {
    console.error("Error fetching students by class:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch students by class" 
    });
  }
});

// 7. GET STUDENTS BY AGE GROUP (Admin)
app.get("/admin/students/age/:age", async (req, res) => {
  try {
    const { age } = req.params;
    const ageNum = parseInt(age);
    
    if (isNaN(ageNum) || ageNum < 3 || ageNum > 5) {
      return res.status(400).json({ 
        success: false, 
        error: "Age must be between 3 and 5" 
      });
    }
    
    const students = await StudentProfileModel.find({ age: ageNum }).sort({ fullName: 1 });
    
    res.json({ 
      success: true, 
      students: students,
      total: students.length,
      age: ageNum
    });
  } catch (error) {
    console.error("Error fetching students by age:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch students by age" 
    });
  }
});

// 8. GET STUDENT STATISTICS (Admin)
app.get("/admin/students/stats/summary", async (req, res) => {
  try {
    const [
      totalStudents,
      daycareOnly,
      lkgOnly,
      ukgOnly,
      withDaycare,
      maleCount,
      femaleCount,
      age3Count,
      age4Count,
      age5Count
    ] = await Promise.all([
      StudentProfileModel.countDocuments(),
      StudentProfileModel.countDocuments({ class: "Daycare", includeDaycare: false }),
      StudentProfileModel.countDocuments({ class: "LKG", includeDaycare: false }),
      StudentProfileModel.countDocuments({ class: "UKG", includeDaycare: false }),
      StudentProfileModel.countDocuments({ includeDaycare: true }),
      StudentProfileModel.countDocuments({ gender: "Male" }),
      StudentProfileModel.countDocuments({ gender: "Female" }),
      StudentProfileModel.countDocuments({ age: 3 }),
      StudentProfileModel.countDocuments({ age: 4 }),
      StudentProfileModel.countDocuments({ age: 5 })
    ]);
    
    // Get blood type distribution
    const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    const bloodTypeStats = {};
    for (const type of bloodTypes) {
      bloodTypeStats[type] = await StudentProfileModel.countDocuments({ bloodType: type });
    }
    
    res.json({
      success: true,
      statistics: {
        total: totalStudents,
        byClass: {
          daycareOnly: daycareOnly,
          lkgOnly: lkgOnly,
          ukgOnly: ukgOnly,
          withDaycare: withDaycare,
          totalDaycare: daycareOnly + withDaycare,
          totalLKG: lkgOnly + (withDaycare ? StudentProfileModel.countDocuments({ class: "LKG", includeDaycare: true }) : 0),
          totalUKG: ukgOnly + (withDaycare ? StudentProfileModel.countDocuments({ class: "UKG", includeDaycare: true }) : 0)
        },
        byGender: {
          male: maleCount,
          female: femaleCount
        },
        byAge: {
          age3: age3Count,
          age4: age4Count,
          age5: age5Count
        },
        byBloodType: bloodTypeStats
      }
    });
  } catch (error) {
    console.error("Error fetching student statistics:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch student statistics" 
    });
  }
});

// 9. BULK DELETE STUDENTS (Admin)
app.post("/admin/students/bulk-delete", async (req, res) => {
  try {
    const { childIds } = req.body;
    
    if (!childIds || !Array.isArray(childIds) || childIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: "Array of child IDs is required" 
      });
    }
    
    const results = {
      deleted: [],
      notFound: [],
      errors: []
    };
    
    for (const childId of childIds) {
      try {
        const deletedStudent = await StudentProfileModel.findOneAndDelete({ 
          childId: { $regex: new RegExp(`^${childId}$`, 'i') }
        });
        
        if (deletedStudent) {
          results.deleted.push({
            childId: deletedStudent.childId,
            fullName: deletedStudent.fullName
          });
          
          // Delete associated records
          await Attendance.deleteMany({ 
            childId: { $regex: new RegExp(`^${childId}$`, 'i') }
          });
          
          await DaycareAttendanceModel.deleteMany({ 
            childId: { $regex: new RegExp(`^${childId}$`, 'i') }
          });
        } else {
          results.notFound.push(childId);
        }
      } catch (err) {
        results.errors.push({ childId, error: err.message });
      }
    }
    
    res.json({
      success: true,
      message: `Deleted ${results.deleted.length} students successfully`,
      results: results
    });
    
  } catch (error) {
    console.error("Error in bulk delete:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to perform bulk delete" 
    });
  }
});

// 10. EXPORT STUDENTS TO CSV (Admin)
app.get("/admin/students/export/csv", async (req, res) => {
  try {
    const { class: className, age, gender } = req.query;
    let query = {};
    
    if (className) query.class = className;
    if (age) query.age = parseInt(age);
    if (gender) query.gender = gender;
    
    const students = await StudentProfileModel.find(query).sort({ fullName: 1 });
    
    if (students.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: "No students found for the selected criteria" 
      });
    }
    
    // Create CSV headers
    const headers = [
      "Child ID", "Full Name", "Gender", "Class", "Daycare Add-on", 
      "Date of Birth", "Age", "Blood Type", "Guardian Name", 
      "Email", "Contact Numbers", "Medical Information", "Registered Date"
    ];
    
    const csvRows = [
      headers.join(","),
      ...students.map(student => {
        return [
          `"${student.childId}"`,
          `"${student.fullName}"`,
          `"${student.gender}"`,
          `"${student.class}"`,
          `"${student.includeDaycare ? 'Yes' : 'No'}"`,
          `"${student.dob ? new Date(student.dob).toLocaleDateString() : ''}"`,
          `"${student.age}"`,
          `"${student.bloodType}"`,
          `"${student.guardianName}"`,
          `"${student.email}"`,
          `"${student.contactNumbers ? student.contactNumbers.join(', ') : ''}"`,
          `"${(student.medicalInformation || '').replace(/"/g, '""')}"`,
          `"${student.createdAt ? new Date(student.createdAt).toLocaleDateString() : ''}"`
        ].join(",");
      })
    ];
    
    const csvContent = csvRows.join("\n");
    const fileName = `students_export_${new Date().toISOString().split('T')[0]}.csv`;
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(csvContent);
    
  } catch (error) {
    console.error("Error exporting students:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to export student data" 
    });
  }
});

// 11. GET RECENT STUDENTS (For Dashboard)
app.get("/admin/students/recent/:limit", async (req, res) => {
  try {
    const { limit = 10 } = req.params;
    
    const students = await StudentProfileModel.find()
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select('childId fullName class age profilePhoto createdAt');
    
    res.json({
      success: true,
      students: students,
      count: students.length
    });
  } catch (error) {
    console.error("Error fetching recent students:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch recent students" 
    });
  }
});

// 12. GET STUDENTS WITH NO PROFILE PHOTO
app.get("/admin/students/no-photo", async (req, res) => {
  try {
    const students = await StudentProfileModel.find({
      $or: [
        { profilePhoto: { $regex: /^[👦👧]$/ } },
        { profilePhoto: { $exists: false } }
      ]
    }).select('childId fullName class gender');
    
    res.json({
      success: true,
      students: students,
      count: students.length
    });
  } catch (error) {
    console.error("Error fetching students without photos:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch students" 
    });
  }
});

// 13. UPDATE STUDENT PHOTO (Admin)
app.put("/admin/students/:childId/photo", async (req, res) => {
  try {
    const { childId } = req.params;
    const { profilePhoto } = req.body;
    
    if (!profilePhoto) {
      return res.status(400).json({ 
        success: false, 
        error: "Profile photo is required" 
      });
    }
    
    const updatedStudent = await StudentProfileModel.findOneAndUpdate(
      { childId: { $regex: new RegExp(`^${childId}$`, 'i') } },
      { $set: { profilePhoto: profilePhoto } },
      { new: true }
    ).select('childId fullName profilePhoto');
    
    if (!updatedStudent) {
      return res.status(404).json({ 
        success: false, 
        error: "Student not found" 
      });
    }
    
    res.json({
      success: true,
      message: "Profile photo updated successfully!",
      student: updatedStudent
    });
    
  } catch (error) {
    console.error("Error updating student photo:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to update profile photo" 
    });
  }
});

// 14. GET STUDENT ATTENDANCE SUMMARY (Admin)
app.get("/admin/students/:childId/attendance-summary", async (req, res) => {
  try {
    const { childId } = req.params;
    const { startDate, endDate } = req.query;
    
    let query = { 
      childId: { $regex: new RegExp(`^${childId}$`, 'i') }
    };
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }
    
    const attendanceRecords = await Attendance.find(query).sort({ date: -1 });
    
    const totalDays = attendanceRecords.length;
    const presentDays = attendanceRecords.filter(a => a.attendanceStatus === "Present").length;
    const lateDays = attendanceRecords.filter(a => a.attendanceStatus === "Late").length;
    const halfDays = attendanceRecords.filter(a => a.attendanceStatus === "Half Day").length;
    const absentDays = attendanceRecords.filter(a => a.attendanceStatus === "Absent").length;
    
    res.json({
      success: true,
      childId: childId,
      student: await StudentProfileModel.findOne({ childId: { $regex: new RegExp(`^${childId}$`, 'i') } }).select('fullName class'),
      attendanceSummary: {
        totalDays: totalDays,
        presentDays: presentDays,
        lateDays: lateDays,
        halfDays: halfDays,
        absentDays: absentDays,
        attendancePercentage: totalDays > 0 ? ((presentDays + lateDays + halfDays) / totalDays * 100).toFixed(2) : 0
      },
      recentRecords: attendanceRecords.slice(0, 10)
    });
    
  } catch (error) {
    console.error("Error fetching attendance summary:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch attendance summary" 
    });
  }
});

// ================================
// CHILD DELETION API
// ================================

// 1. DELETE CHILD AND ALL ASSOCIATED DATA
app.delete("/children/:childId", async (req, res) => {
  try {
    const { childId } = req.params;
    
    console.log(`Attempting to delete child: ${childId}`);

    // First check if child exists
    const child = await ChildModel.findOne({ 
      childId: { $regex: new RegExp(`^${childId}$`, 'i') }
    });

    if (!child) {
      return res.status(404).json({ 
        success: false, 
        error: "Child not found" 
      });
    }

    // Store child details for response
    const childDetails = {
      childId: child.childId,
      childName: child.childName
    };

    // Delete from Child collection
    const deletedChild = await ChildModel.findOneAndDelete({ 
      childId: { $regex: new RegExp(`^${childId}$`, 'i') }
    });

    // Delete from NewChildPwd collection (password changes)
    const deletedPassword = await NewChildPwdModel.findOneAndDelete({ 
      childId: { $regex: new RegExp(`^${childId}$`, 'i') }
    });

    // Delete from StudentProfile collection
    const deletedProfile = await StudentProfileModel.findOneAndDelete({ 
      childId: { $regex: new RegExp(`^${childId}$`, 'i') }
    });

    // Delete from DaycareAttendance collection
    const deletedDaycareAttendance = await DaycareAttendanceModel.deleteMany({ 
      childId: { $regex: new RegExp(`^${childId}$`, 'i') }
    });

    // Delete from Attendance collection
    const deletedAttendance = await Attendance.deleteMany({ 
      childId: { $regex: new RegExp(`^${childId}$`, 'i') }
    });

    console.log(`Successfully deleted child: ${childId}`);
    console.log(`- Profile deleted: ${!!deletedProfile}`);
    console.log(`- Password records deleted: ${!!deletedPassword}`);
    console.log(`- Attendance records deleted: ${deletedAttendance.deletedCount}`);
    console.log(`- Daycare records deleted: ${deletedDaycareAttendance.deletedCount}`);

    res.status(200).json({ 
      success: true, 
      message: `Child "${childDetails.childName}" has been deleted successfully!`,
      deletedChild: childDetails,
      stats: {
        profileDeleted: !!deletedProfile,
        passwordDeleted: !!deletedPassword,
        attendanceDeleted: deletedAttendance.deletedCount,
        daycareDeleted: deletedDaycareAttendance.deletedCount
      }
    });

  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to delete child. Please try again." 
    });
  }
});

// 2. BULK DELETE CHILDREN (Admin)
app.post("/children/bulk-delete", async (req, res) => {
  try {
    const { childIds } = req.body;
    
    if (!childIds || !Array.isArray(childIds) || childIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: "Array of child IDs is required" 
      });
    }

    const results = {
      deleted: [],
      notFound: [],
      errors: []
    };

    for (const childId of childIds) {
      try {
        // Find the child first
        const child = await ChildModel.findOne({ 
          childId: { $regex: new RegExp(`^${childId}$`, 'i') }
        });

        if (!child) {
          results.notFound.push(childId);
          continue;
        }

        const childDetails = {
          childId: child.childId,
          childName: child.childName
        };

        // Delete from all collections
        await ChildModel.findOneAndDelete({ 
          childId: { $regex: new RegExp(`^${childId}$`, 'i') }
        });
        
        await NewChildPwdModel.findOneAndDelete({ 
          childId: { $regex: new RegExp(`^${childId}$`, 'i') }
        });
        
        await StudentProfileModel.findOneAndDelete({ 
          childId: { $regex: new RegExp(`^${childId}$`, 'i') }
        });
        
        await DaycareAttendanceModel.deleteMany({ 
          childId: { $regex: new RegExp(`^${childId}$`, 'i') }
        });
        
        await Attendance.deleteMany({ 
          childId: { $regex: new RegExp(`^${childId}$`, 'i') }
        });

        results.deleted.push(childDetails);
        
      } catch (err) {
        results.errors.push({ childId, error: err.message });
      }
    }

    res.json({
      success: true,
      message: `Deleted ${results.deleted.length} children successfully`,
      results: results
    });

  } catch (error) {
    console.error("Error in bulk delete:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to perform bulk delete" 
    });
  }
});


// ================================
// STUDENT API FOR QR CODE GENERATOR (Using Child Model)
// ================================

// GET ALL STUDENTS (For QR Code Generator) - Using Child Model
app.get("/students", async (req, res) => {
  try {
    // Fetch all children from the Child model
    const children = await ChildModel.find()
      .sort({ childName: 1 })
      .select('childId childName registeredDate');
    
    // If no children found, return empty array
    if (!children || children.length === 0) {
      return res.json({ 
        success: true, 
        students: [],
        message: "No students found" 
      });
    }
    
    // Format the response to match what QRCodeGenerator expects
    const formattedStudents = children.map(child => ({
      childId: child.childId,
      childName: child.childName,
      className: 'Not Assigned', // You can modify this if you have class info elsewhere
      registeredDate: child.registeredDate
    }));
    
    res.json({ 
      success: true, 
      students: formattedStudents,
      total: formattedStudents.length 
    });
    
  } catch (error) {
    console.error("Error fetching students for QR generator:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch students data",
      details: error.message 
    });
  }
});

// GET SINGLE STUDENT BY ID (For QR Code Generator)
app.get("/students/:childId", async (req, res) => {
  try {
    const { childId } = req.params;
    
    const child = await ChildModel.findOne({ 
      childId: { $regex: new RegExp(`^${childId}$`, 'i') }
    });
    
    if (!child) {
      return res.status(404).json({ 
        success: false, 
        error: "Student not found" 
      });
    }
    
    res.json({ 
      success: true, 
      student: {
        childId: child.childId,
        childName: child.childName,
        className: 'Not Assigned'
      }
    });
    
  } catch (error) {
    console.error("Error fetching student:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch student data" 
    });
  }
});

// Health check endpoint for Docker
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// --- SERVER INITIALIZATION ---
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));