const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const moment = require('moment-timezone');


const app = express();


app.use(cors());
app.use(bodyParser.json());  //it is require for get data from request body
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/favicon.ico', (req, res, next) => {
  res.status(204).end(); // No content for favicon requests
});


const connectToDB = async () => {
  try {
    await mongoose.connect('mongodb+srv://saksha:1234@cluster0.xnvkwgq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
      useNewUrlParser: true,
      useUnifiedTopology: true

    });
    console.log("connected to MongoDb");

  } catch (error) {
    console.log(error);
    process.exit(1);

  }
}
connectToDB();

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});


const bookserviceSchema = new mongoose.Schema({
  date: { type: String, required: true},
  name: { type: String, required: true, minlength:3, maxlength:30},
  phoneNumber: {type: String, required: true,  match: /^[0-9]{10}$/ },
  email: { type: String, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  service:  {type: String, required: true},
  message: { type: String, minlength: 0, maxlength: 500,},
  requestId: { type: String, required: true },
  requestDate: { type: Date, required: true },
  serviceType: { type: String, required: true },
  assignedTo: String,
  startDate: { type: Date },
  endDate: { type: Date },
  totalDays: Number,
  severity: String,
  status: String,
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

const BookServices = mongoose.model('BookServices', bookserviceSchema, 'bookservices');


const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  sequence_value: { type: Number, default: 0 }
});

const Counter = mongoose.model('Counter', counterSchema);

const getNextSequenceValue = async (sequenceName) => {
  const sequenceDocument = await Counter.findOneAndUpdate(
    { _id: sequenceName },
    { $inc: { sequence_value: 1 } },
    { new: true, upsert: true }
  );
  return sequenceDocument.sequence_value;
};


app.get('/getBookedServicesData', async (req, res) => {
  try {
    const data = await BookServices.find().sort({ date: -1 });
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Add the DELETE endpoint to delete a booked service by ID
app.delete('/getBookedServicesData/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedService = await BookServices.findByIdAndDelete(id);

    if (!deletedService) { 
      return res.status(404).json({ error: 'Service request not found' });
    }

    res.status(204).end(); // No content, successful deletion
  } catch (error) {    
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST endpoint to add data to BookServices
app.post('/add-service', async (req, res) => {
  try {
    const { name, phoneNumber, email, service, message } = req.body;

    // Get current date and time in Indian timezone
    const currentDate = moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');

    // Count the documents in the BookService collection to generate a sequential ID
    // const count = await BookServices.countDocuments();
    const sequenceValue = await getNextSequenceValue('requestId');
    const formattedRequestId = `SR-${String(sequenceValue+1).padStart(2, '0')}`;

    // Validate request body
    if (!name || !phoneNumber || !service) {
      return res.status(400).json({ error: 'Validation failed: name, phoneNumber, and service fields are required.' });
    }

    // Create a new instance of the BookServices model
    const newService = new BookServices({
      date: currentDate, 
      name: name,
      phoneNumber: phoneNumber,
      email: email,
      service: service,
      message: message,
      requestId: formattedRequestId,
      requestDate: currentDate,
      serviceType: service,
      status: 'New'
    });

    // Save the data to the database
    const savedService = await newService.save();

    res.status(201).json(savedService);
  } catch (error) {
    res.status(500).json({ message: 'An error occurred while adding the service', error: error.message });
  }
});


app.put('/getBookedServicesData/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updatedData = req.body;

    // Find the service request by ID and update it
    const updatedService = await BookServices.findByIdAndUpdate(id, updatedData, { new: true });

    if (!updatedService) {
      return res.status(404).json({ error: 'Service request not found' });
    }

    res.json(updatedService);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

const loginSchema = new mongoose.Schema({
  EmailAddressmail: String,
  Password: String,
});

const LoginModel = mongoose.model('login', loginSchema, 'adminlogin');


app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Function to verify the user
    const verifyUser = async (UserModel, emailField, passwordField, extraConditions = {}) => {
      const user = await UserModel.findOne({ [emailField]: email, ...extraConditions});
      if (user && user[passwordField] === password) {
        return user;
      }
      return null;
    };

    // Check both collections
    const masterAdmin = await verifyUser(LoginModel, 'EmailAddressmail', 'Password');
    const admin = await verifyUser(User, 'EmailAddress', 'Password', {Usertype:'Admin'});

    if (!masterAdmin && !admin) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = masterAdmin || admin;
    const userType = masterAdmin ? 'MasterAdmin' : 'Admin';

    res.json({ message: 'Login successful', user, userType });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


const serviceSchema = new mongoose.Schema({
  service: String
});
const ServiceModel = mongoose.model('service', serviceSchema, 'service');

app.get('/api/service', async (req, res) => {
  try {
    const data = await ServiceModel.find();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Define user schema and model
const userSchema = new mongoose.Schema({
  Username: String,
  Usertype: String,
  MobileNumber: String,
  EmailAddress: String,
  Password: String 
});

const User = mongoose.model('User', userSchema);

// API endpoint to save user data
app.post('/api/users', async (req, res) => {
  try {
    const { Username, Usertype, MobileNumber, EmailAddress, Password } = req.body;

    // Create a new user instance
    const newUser = new User({
      Username,
      Usertype,
      MobileNumber,
      EmailAddress,
      Password
    });

    // Save the user to the database
    const savedUser = await newUser.save();

    res.status(201).json(savedUser);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// API endpoint to fetch all users
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT endpoint to update user data
app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate request body
    const { Username, Usertype, MobileNumber, EmailAddress, Password } = req.body;
    if (!Username || !Usertype || !MobileNumber || !EmailAddress || !Password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const updatedUser = await User.findByIdAndUpdate(id, req.body, { new: true });
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



// Delete a contact
app.delete('/api/Users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await User.findByIdAndDelete(id);
    res.status(204).end(); // No content, successful deletion
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Add a route for the root path
app.get('/', (req, res) => {
  res.send('Welcome to the server!');
});

const port = 2000;
app.listen(port, () => {
  console.log("server is started successfully");
});