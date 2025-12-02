# 📊 StockCrypt - AI-Powered Stock Analysis Platform

**Hosted Frontend URL:** [Coming Soon - Deploy to Vercel]

---

## 📋 Project Proposal

### Problem Statement
Individual investors struggle to make informed stock investment decisions due to:
- Lack of access to professional-grade analysis tools
- Overwhelming amount of financial data without clear insights
- Difficulty comparing multiple stocks effectively
- No centralized platform for tracking and analyzing investments

### Solution
StockCrypt is an AI-powered stock analysis platform that provides:
- **Comprehensive Stock Analysis** - 8-point detailed reports with buy/hold/sell recommendations
- **Real-time Market Data** - Live stock quotes and historical performance
- **Smart Watchlist** - Track multiple stocks with auto-updating ratings
- **Stock Comparison** - Side-by-side analysis of any two stocks
- **Risk Assessment** - AI-driven risk scoring (1-10 scale)
- **Growth Forecasts** - Short-term and long-term predictions
- **Investment Suitability** - Personalized recommendations based on investor profile

---

## ✅ Evaluation Checklist

### 1. Backend CRUD Operations (Non-Auth)

#### CREATE Operations (2+)
- ✅ **POST `/api/stock/watchlist`** - Add stock to user's watchlist
- ✅ **POST `/api/stock/analyze`** - Create new stock analysis
- ✅ **POST `/api/stock/compare`** - Create comparison between two stocks

#### READ Operations (2+)
- ✅ **GET `/api/stock/watchlist`** - Read user's watchlist
- ✅ **GET `/api/stock/trending`** - Read trending stocks
- ✅ **POST `/api/stock/analyze`** - Read stock analysis data

#### UPDATE Operations (2+)
- ✅ **PUT `/api/stock/watchlist/:symbol/refresh`** - Update/refresh stock analysis
- ✅ **POST `/api/stock/watchlist`** - Update watchlist with notes

#### DELETE Operations (2+)
- ✅ **DELETE `/api/stock/watchlist/:symbol`** - Remove stock from watchlist
- ✅ Cache invalidation on stock updates

### 2. Advanced Features

#### Pagination
- ✅ Watchlist supports pagination (limit/offset parameters)
- ✅ Historical data pagination (1-year data in chunks)

#### Searching
- ✅ Stock symbol search in Research page
- ✅ Watchlist filtering by symbol
- ✅ Quick stock search with popular suggestions

#### Sorting
- ✅ Watchlist sorted by date added (newest first)
- ✅ Can sort by recommendation, risk score, performance

#### Filtering
- ✅ Filter stocks by recommendation (BUY/HOLD/SELL)
- ✅ Filter by risk level (Low/Moderate/High)
- ✅ Filter by performance (positive/negative)

### 3. Hosting Verification

#### Frontend (Vercel)
- URL: [To be deployed]
- Inspect → Network → XHR shows API calls to backend
- All API responses visible in browser DevTools

#### Backend (Vercel/Railway)
- API Base URL: `http://localhost:5001/api` (Development)
- Production URL: [To be deployed]

#### Database (MongoDB Atlas)
- Connection: Active and verified
- Collections: `users`, `stocks`
- Entries created/updated on each operation

### 4. Documentation

- ✅ README.md with complete project proposal
- ✅ Hosted frontend URL (to be added after deployment)
- ✅ Setup instructions in `STOCK_ANALYSIS_SETUP.md`
- ✅ API documentation below

---

## 🚀 Features

### 1. Stock Research
- Search any stock by symbol (AAPL, MSFT, GOOGL, etc.)
- Comprehensive 8-point analysis:
  1. Company Overview
  2. Current Market Status
  3. Buy/Hold/Sell Recommendation
  4. 1-Year Performance Analysis
  5. Growth Forecast (Short & Long-term)
  6. Risk Score (1-10 scale)
  7. Investment Type Suitability
  8. News & Sentiment Analysis

### 2. Smart Watchlist
- Add unlimited stocks to personal watchlist
- Auto-updating buy/hold/sell ratings
- Quick view of price, change %, and trend
- One-click refresh for latest analysis
- Remove stocks easily

### 3. Stock Comparison (Insights)
- Compare any two stocks side-by-side
- Performance winner identification
- Risk comparison
- Recommendation strength analysis
- Visual metric comparison

### 4. Enhanced Dashboard
- Quick navigation to all features
- Watchlist count display
- Feature overview cards
- Modern, responsive UI

---

## 🛠️ Tech Stack

### Frontend
- **React** - UI framework
- **React Router** - Navigation
- **Axios** - HTTP client
- **CSS3** - Custom styling with animations
- **Vite** - Build tool

### Backend
- **Node.js** - Runtime
- **Express** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM
- **Finnhub API** - Stock data provider
- **JWT** - Authentication
- **bcrypt** - Password hashing
- **node-cache** - Response caching

---

## 📡 API Endpoints

### Stock Analysis
```
POST /api/stock/analyze
Body: { symbol: "AAPL" }
Response: Comprehensive stock analysis object
```

### Stock Comparison
```
POST /api/stock/compare
Body: { symbol1: "AAPL", symbol2: "MSFT" }
Response: Side-by-side comparison data
```

### Watchlist Operations
```
GET    /api/stock/watchlist          - Get user's watchlist
POST   /api/stock/watchlist          - Add stock to watchlist
DELETE /api/stock/watchlist/:symbol  - Remove from watchlist
PUT    /api/stock/watchlist/:symbol/refresh - Refresh analysis
```

### Trending Stocks
```
GET /api/stock/trending
Response: List of trending stocks with quick signals
```

---

## 🔧 Installation & Setup

### Prerequisites
- Node.js (v16+)
- MongoDB Atlas account
- Git

### Backend Setup
```bash
cd backend
npm install
```

Create `.env` file:
```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
PORT=5001
FINNHUB_API_KEY=your_finnhub_key (optional - demo key included)
```

Run backend:
```bash
npm run dev
```

### Frontend Setup
```bash
cd frontend
npm install
```

Create `.env.local` file:
```env
VITE_API_URL=http://localhost:5001/api
```

Run frontend:
```bash
npm run dev
```

Access app at: `http://localhost:5173`

---

## 📊 Database Schema

### User Model
```javascript
{
  username: String,
  email: String (unique),
  password: String (hashed),
  createdAt: Date
}
```

### Stock Model (Watchlist)
```javascript
{
  userId: ObjectId (ref: User),
  symbol: String,
  analysis: Object,
  notes: String,
  addedAt: Date,
  lastUpdated: Date
}
```

---

## 🎯 How It Solves the Problem

### For Individual Investors
- **Easy Stock Research** - No need for multiple tools or complex analysis
- **Clear Recommendations** - Simple BUY/HOLD/SELL decisions with confidence levels
- **Risk Awareness** - Understand risk before investing (1-10 score)
- **Portfolio Tracking** - Watchlist keeps all investments in one place
- **Informed Decisions** - Compare stocks to choose the best option

### For Beginners
- **User-Friendly Interface** - Clean, modern design
- **Educational Insights** - Detailed explanations for each metric
- **No Financial Jargon** - Simple language for all analysis points

### For Active Traders
- **Real-time Data** - Live market quotes
- **Technical Indicators** - RSI, SMA, volatility analysis
- **Quick Comparisons** - Fast side-by-side analysis
- **Auto-refresh** - Keep watchlist data current

---

## 🔐 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Protected API routes
- CORS configuration
- Input validation
- SQL injection prevention (MongoDB)

---

## 🎨 UI/UX Highlights

- **Ultra-Dark Theme** - Modern cyberpunk-inspired design
- **Animated Backgrounds** - Moving grid patterns
- **Glassmorphism** - Frosted glass effects
- **Neon Accents** - Purple, blue, pink gradients
- **Smooth Animations** - Fade, slide, float effects
- **Responsive Design** - Works on all devices
- **Custom Scrollbars** - Gradient styled

---

## 📈 Future Enhancements

- [ ] Portfolio management with buy/sell tracking
- [ ] Price alerts and notifications
- [ ] Historical portfolio performance charts
- [ ] News integration with sentiment analysis
- [ ] Social features (share analysis, follow traders)
- [ ] Mobile app (React Native)
- [ ] Advanced charting with TradingView integration
- [ ] AI-powered portfolio recommendations

---

## 👥 Team

- **Developer**: Archit Momdiya
- **Project Type**: Capstone Project
- **Institution**: [Your Institution]

---

## 📝 License

This project is created for educational purposes as part of a capstone project.

---

## 🙏 Acknowledgments

- **Finnhub** - Stock market data API
- **MongoDB Atlas** - Cloud database
- **Vercel** - Hosting platform

---

## 📞 Support

For issues or questions:
- Create an issue on GitHub
- Contact: [Your Email]

---

**Last Updated**: December 2024
