const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Worksheet = require('../models/Worksheet');

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/worksheets');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'worksheet-' + uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 
                        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, Images, and Word documents are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// GET all worksheets
router.get('/', async (req, res) => {
  try {
    const { className, category, status = 'Active' } = req.query;
    let query = { status: status };
    
    if (className) query.className = className;
    if (category) query.category = category;
    
    const worksheets = await Worksheet.find(query).sort({ uploadedAt: -1 });
    res.json(worksheets);
  } catch (error) {
    console.error('Error fetching worksheets:', error);
    res.status(500).json({ error: 'Failed to fetch worksheets' });
  }
});

// GET worksheet by ID
router.get('/:worksheetId', async (req, res) => {
  try {
    const { worksheetId } = req.params;
    const worksheet = await Worksheet.findOne({ worksheetId: worksheetId });
    
    if (!worksheet) {
      return res.status(404).json({ error: 'Worksheet not found' });
    }
    
    res.json(worksheet);
  } catch (error) {
    console.error('Error fetching worksheet:', error);
    res.status(500).json({ error: 'Failed to fetch worksheet' });
  }
});

// GET download worksheet
router.get('/:worksheetId/download', async (req, res) => {
  try {
    const { worksheetId } = req.params;
    const worksheet = await Worksheet.findOne({ worksheetId: worksheetId });
    
    if (!worksheet) {
      return res.status(404).json({ error: 'Worksheet not found' });
    }
    
    // Increment download count
    worksheet.downloadCount += 1;
    await worksheet.save();
    
    const filePath = path.join(__dirname, '..', worksheet.fileUrl);
    
    if (fs.existsSync(filePath)) {
      res.download(filePath, worksheet.fileName);
    } else {
      res.status(404).json({ error: 'File not found on server' });
    }
  } catch (error) {
    console.error('Error downloading worksheet:', error);
    res.status(500).json({ error: 'Failed to download worksheet' });
  }
});

// POST upload worksheets
router.post('/upload', upload.array('worksheets', 10), async (req, res) => {
  try {
    const { className, category, subject, title, description, tags, uploadedBy, uploadedByName } = req.body;
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    if (!className || !category || !subject || !title) {
      return res.status(400).json({ error: 'Missing required fields: className, category, subject, title' });
    }
    
    const uploadedWorksheets = [];
    
    for (const file of req.files) {
      const fileUrl = `/uploads/worksheets/${file.filename}`;
      
      const worksheet = new Worksheet({
        className,
        category,
        subject,
        title,
        description: description || '',
        tags: tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [],
        fileName: file.originalname,
        fileUrl: fileUrl,
        fileType: file.mimetype,
        fileSize: file.size,
        uploadedBy: uploadedBy || 'Admin',
        uploadedByName: uploadedByName || 'Administrator'
      });
      
      await worksheet.save();
      uploadedWorksheets.push(worksheet);
    }
    
    res.json({
      success: true,
      message: 'Worksheets uploaded successfully',
      uploadedCount: uploadedWorksheets.length,
      worksheets: uploadedWorksheets
    });
    
  } catch (error) {
    console.error('Error uploading worksheets:', error);
    res.status(500).json({ error: 'Failed to upload worksheets: ' + error.message });
  }
});

// DELETE worksheet
router.delete('/:worksheetId', async (req, res) => {
  try {
    const { worksheetId } = req.params;
    const worksheet = await Worksheet.findOne({ worksheetId: worksheetId });
    
    if (!worksheet) {
      return res.status(404).json({ error: 'Worksheet not found' });
    }
    
    // Soft delete - just mark as deleted
    worksheet.status = 'Deleted';
    await worksheet.save();
    
    res.json({ success: true, message: 'Worksheet deleted successfully' });
    
  } catch (error) {
    console.error('Error deleting worksheet:', error);
    res.status(500).json({ error: 'Failed to delete worksheet' });
  }
});

// UPDATE worksheet
router.put('/:worksheetId', async (req, res) => {
  try {
    const { worksheetId } = req.params;
    const updateData = req.body;
    
    // Remove fields that shouldn't be updated
    delete updateData._id;
    delete updateData.worksheetId;
    delete updateData.fileUrl;
    delete updateData.fileName;
    delete updateData.fileType;
    delete updateData.fileSize;
    delete updateData.uploadedAt;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    
    const worksheet = await Worksheet.findOneAndUpdate(
      { worksheetId: worksheetId },
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    if (!worksheet) {
      return res.status(404).json({ error: 'Worksheet not found' });
    }
    
    res.json({ success: true, message: 'Worksheet updated successfully', worksheet });
    
  } catch (error) {
    console.error('Error updating worksheet:', error);
    res.status(500).json({ error: 'Failed to update worksheet' });
  }
});

module.exports = router;