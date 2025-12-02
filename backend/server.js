const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());

// Dynamic CORS configuration to handle all Vercel deployments
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = [
            'http://localhost:5173',
            'http://localhost:5174',
            'http://localhost:5175',
            'http://localhost:5177'
        ];

        // Allow all Vercel deployments (*.vercel.app)
        const isVercelDomain = origin && origin.endsWith('.vercel.app');

        // Allow if origin is in allowedOrigins or is a Vercel domain or is undefined (for non-browser requests)
        if (!origin || allowedOrigins.includes(origin) || isVercelDomain) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
};

app.use(cors(corsOptions));

// Database Connection
connectDB();

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/stock', require('./routes/stock'));
app.use('/api/portfolio', require('./routes/portfolio'));

app.get('/', (req, res) => {
    res.send('StockCrypt Backend Running');
});


// Export the Express API
module.exports = app;

// Only run the server if not in Vercel environment (Vercel handles this)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}
