/*
CSC3916 Final Project
File: Server.js
Description: A centralized system designed to help campus organizations coordinate event planning and detect scheduling conflicts.
Instructions:
1. in terminal, run "npm install"
2. run "npm install mongodb"
3. then to start the server, run "npm start"

*/
require('dotenv').config();

var express = require('express');
var bodyParser = require('body-parser');
var passport = require('passport');
var authController = require('./auth');
var authJwtController = require('./auth_jwt');
var jwt = require('jsonwebtoken');
var cors = require('cors');
var User = require('./Users');
var Event = require('./Events');
var Organization = require('./Organizations');
var EventFeedback = require('./EventFeedback');
var mongoose = require('mongoose');

var app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(passport.initialize());

const router = express.Router();


mongoose.connect(process.env.DB, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));



router.post('/signup', async (req, res) => { // Use async/await
  if (!req.body.username || !req.body.password) {
    return res.status(400).json({ success: false, msg: 'Please include both username and password to signup.' }); // 400 Bad Request
  }

  try {
    const user = new User({ // Create user directly with the data
      name: req.body.name,
      username: req.body.username,
      password: req.body.password,
      organizationID: req.body.organizationID
    });

    await user.save(); // Use await with user.save()

    res.status(201).json({ success: true, msg: 'Successfully created new user.' }); // 201 Created
  } catch (err) {
    if (err.code === 11000) { // Strict equality check (===)
      return res.status(409).json({ success: false, message: 'A user with that username already exists.' }); // 409 Conflict
    } else {
      console.error(err); // Log the error for debugging
      return res.status(500).json({ success: false, message: 'Something went wrong. Please try again later.' }); // 500 Internal Server Error
    }
  }
});


router.post('/signin', async (req, res) => { // Use async/await
  try {
    const user = await User.findOne({ username: req.body.username }).select('name username password organizationID');

    if (!user) {
      return res.status(401).json({ success: false, msg: 'Authentication failed. User not found.' }); // 401 Unauthorized
    }

    const isMatch = await user.comparePassword(req.body.password); // Use await

    if (isMatch) {
      const userToken = { 
        id: user._id, 
        username: user.username,
        organizationID: user.organizationID
      };
      const token = jwt.sign(userToken, process.env.SECRET_KEY, { expiresIn: '1h' }); // Add expiry to the token (1 hour)
      res.json({ success: true, token: 'JWT ' + token });
    } else {
      res.status(401).json({ success: false, msg: 'Authentication failed. Incorrect password.' }); // 401 Unauthorized
    }
  } catch (err) {
  console.error("SIGNIN ERROR:", err);
  console.log("SECRET_KEY:", process.env.SECRET_KEY);
  console.log("REQUEST BODY:", req.body);

  res.status(500).json({
    success: false,
    error: err.message
  });
}
});

// --------------------------------------------------------------------------------------------------
// --------------------------------------------------------------------------------------------------
// --------------------------------------------------------------------------------------------------
router.post('/feedback', authJwtController.isAuthenticated, async (req, res) => {
  try {
    const { eventId, feedback, rating } = req.body;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const existing = await EventFeedback.findOne({
      eventId,
      username: req.user.username
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'You already left feedback for this event'
      });
    }

    const newFeedback = new EventFeedback({
      eventId,
      username: req.user.username,
      feedback,
      rating
    });

    await newFeedback.save();

    res.status(201).json({ message: 'Feedback submitted' });

  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/feedback', authJwtController.isAuthenticated, async (req, res) => {
  try {
    const feedback = await EventFeedback.find()
      .populate('eventId', 'title')
      // .populate('userId', 'username');

    res.json(feedback);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// --------------------------------------------------------------------------------------------------
// --------------------------------------------------------------------------------------------------
// --------------------------------------------------------------------------------------------------


router.route('/events')

  .get(authJwtController.isAuthenticated, async (req, res) => {
    try {
      const events = await Event.aggregate([
        {
          $lookup: {
            from: 'eventfeedbacks',
            localField: '_id',
            foreignField: 'eventId',
            as: 'feedback'
          }
        },
        {
          $addFields: {
            avgRating: { $avg: '$feedback.rating' }
          }
        },
        {
          $sort: { startTime: 1 }
        }
      ]);

      res.json(events);

    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  })
  .post(authJwtController.isAuthenticated, async (req, res) => {
    try {
      const { title, location, startTime, endTime } = req.body;

      const organizationID = req.user.organizationID;

      // Conflict detection
      const conflicts = await Event.find({
        startTime: { $lt: new Date(endTime) },
        endTime: { $gt: new Date(startTime) }
      });

      const newEvent = new Event({
        title,
        location,
        startTime,
        endTime,
        organizationID
      });

      await newEvent.save();

      res.status(201).json({
        event: newEvent,
        conflicts   //  RETURN conflicts
      });

    } catch (err) {
      res.status(400).json({ message: err.message });
    }
});

router.route('/events/:id')

.put(authJwtController.isAuthenticated, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // SECURITY CHECK
    if (event.organizationID.toString() !== req.user.organizationID) {
      return res.status(403).json({ message: 'Not allowed' });
    }

    const updatedEvent = await Event.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    res.json(updatedEvent);

  } catch (err) {
    res.status(400).json({ message: err.message });
  }
})

.delete(authJwtController.isAuthenticated, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // SECURITY CHECK
    if (event.organizationID.toString() !== req.user.organizationID) {
      return res.status(403).json({ message: 'Not allowed' });
    }

    await Event.findByIdAndDelete(req.params.id);

    res.json({ message: 'Event deleted' });

  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});


router.get('/events/:id', authJwtController.isAuthenticated, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    res.json(event);

  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/organizations', async (req, res) => {
  try {
    const name = req.body.organizationName;

    if (!name) {
      return res.status(400).json({ message: 'Organization name required' });
    }

    // EXACT match check (case-sensitive)
    const existing = await Organization.findOne({
      organizationName: name
    });

    if (existing) {
      return res.status(409).json({
        message: 'Organization already exists'
      });
    }

    const org = new Organization({ organizationName: name });
    await org.save();

    res.status(201).json(org);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/organizations', async (req, res) => {
  const orgs = await Organization.find();
  res.json(orgs);
});

router.delete('/organizations/:id', async (req, res) => {
  try {
    const deleted = await Organization.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        message: 'Organization not found'
      });
    }

    res.json({
      message: 'Organization deleted successfully'
    });

  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});




const PORT = process.env.PORT || 8080; // Define PORT before using it
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

app.use('/', router);
module.exports = app; // for testing only