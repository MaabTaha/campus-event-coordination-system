var mongoose = require('mongoose');
var Schema = mongoose.Schema;

const EventFeedbackSchema = new Schema({
  eventId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Event',
    required: true
  },

  username: { type: String, required: true },

  feedback: { type: String, required: true },

  rating: { 
    type: Number, 
    min: 1, 
    max: 5, 
    required: true 
  }
});

// Prevent same user from reviewing same event twice
EventFeedbackSchema.index({ eventId: 1, username: 1 }, { unique: true });

module.exports = mongoose.model('EventFeedback', EventFeedbackSchema);