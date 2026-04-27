const mongoose = require('mongoose');

const worksheetSchema = new mongoose.Schema({
  worksheetId: {
    type: String,
    required: true,
    unique: true,
    default: () => 'WS_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
  },
  className: {
    type: String,
    required: true,
    enum: ['LKG', 'UKG']
  },
  category: {
    type: String,
    required: true,
    enum: ['academic', 'creative', 'practice']
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  fileName: {
    type: String,
    required: true
  },
  fileUrl: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  uploadedBy: {
    type: String,
    default: 'Admin'
  },
  uploadedByName: {
    type: String,
    default: 'Administrator'
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['Active', 'Archived', 'Deleted'],
    default: 'Active'
  }
}, {
  timestamps: true
});

// Add indexes for better query performance
worksheetSchema.index({ className: 1, category: 1 });
worksheetSchema.index({ subject: 1 });
worksheetSchema.index({ tags: 1 });

module.exports = mongoose.model('Worksheet', worksheetSchema);