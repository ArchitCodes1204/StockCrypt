const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');
    } catch (err) {
        console.error('MongoDB connection failed:', err.message);
        if (err.message.includes('ENOTFOUND')) {
            console.error('The cluster in MONGO_URI could not be found. Check backend/.env, or run `npm run dev:local` to use an in-memory database.');
        }
        // Exit process with failure
        process.exit(1);
    }
};

module.exports = connectDB;
