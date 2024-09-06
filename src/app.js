const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

const bookRoutes = require('./routes/bookRoutes');
const equipmentRoutes = require('./routes/equipmentRoutes');

const mongoURI = process.env.MONGO_URI;

mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB Atlas');
}).catch((err) => {
  console.error('Error connecting to MongoDB Atlas', err);
});

// Allow multiple origins
const allowedOrigins = ['http://localhost:3000', 'https://biblioteca-haye.vercel.app/'];

const corsOptions = {
  origin: (origin, callback) => {
    if (allowedOrigins.includes(origin) || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'], 
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true, 
  optionsSuccessStatus: 200 
};

app.use(cors(corsOptions)); // Apply CORS middleware
app.use(bodyParser.json());

app.use('/api/books', bookRoutes);
app.use('/api/equipment', equipmentRoutes);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});