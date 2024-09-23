const express = require('express');
const mongoose = require('mongoose');
const stripe = require('stripe')('sk_test_51PslG4DNjvpmSwJTiqz3ZSA6wweG6ThF22vRKRNGjQNI4PS70YR90F39auk8NXoUYP8NBkjoNMgzYmwrLjEHvYKr00eSPzihk8'); // Replace with your Stripe secret key
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());

// Serve static files
app.use('/Assets', express.static(path.join(__dirname, 'public/Assets')));

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/travelDB', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('Failed to connect to MongoDB', err));

// Define Mongoose schema and model for travel
const travelSchema = new mongoose.Schema({
  destTitle: { type: String, required: true },
  location: { type: String, required: true },
  grade: { type: String, required: true },
  fees: { type: String, required: true },
  description: { type: String, required: true },
  imgSrc: { type: String },
  paymentId: { type: String }
});

const Travel = mongoose.model('Travel', travelSchema);

// Define Mongoose schema and model for user
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

const User = mongoose.model('User', userSchema);

// Secret key for JWT
const JWT_SECRET = 'your_jwt_secret_key'; // Replace with your secret key

// Signup route
app.post('/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    // Check if the user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists.' });
    }

    // Hash the password before saving it to the database
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      email,
      password: hashedPassword,
    });

    await newUser.save();

    res.status(201).json({ message: 'User signed up successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
});

// SignIn route
app.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password.' });
    }

    // Compare provided password with the hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password.' });
    }

    // Generate a JWT token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });

    res.status(200).json({
      message: 'Sign in successful',
      token,
    });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
});

// Create a new travel destination
app.post('/travel', async (req, res) => {
  try {
    const { destTitle, location, grade, fees, description } = req.body;

    if (!destTitle || !location || !grade || !fees || !description) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const travel = new Travel({ destTitle, location, grade, fees, description });
    await travel.save();

    res.status(201).json({
      message: 'Travel destination added successfully.',
      travel,
    });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
});

// Get all travel destinations
app.get('/travel', async (req, res) => {
  try {
    const travels = await Travel.find();
    res.status(200).json(travels);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
});

// Get travel destination by ID
app.get('/travel/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid travel ID' });
    }

    const travel = await Travel.findById(id);
    if (!travel) {
      return res.status(404).json({ message: 'Travel destination not found' });
    }
    res.status(200).json(travel);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
});

// Stripe payment intent creation
app.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount) {
      return res.status(400).json({ message: 'Amount is required.' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // amount in cents
      currency: 'usd',
    });

    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
});

// Save payment details
app.post('/save-payment-details', async (req, res) => {
  try {
    const { tripId, amount, paymentId } = req.body;

    if (!tripId || !amount || !paymentId) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const travel = await Travel.findById(tripId);
    if (!travel) {
      return res.status(404).json({ message: 'Travel destination not found' });
    }

    travel.paymentId = paymentId;
    await travel.save();

    res.status(200).json({
      message: 'Payment details saved successfully.',
      travel,
    });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
});

const PORT = process.env.PORT || 5550;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
