# Stock Analysis System Setup Guide

## 🔑 Alpha Vantage API Key Setup

To use the stock analysis features, you need a free Alpha Vantage API key:

### Get Your API Key
1. Visit [Alpha Vantage](https://www.alphavantage.co/support/#api-key)
2. Enter your email and get instant access
3. Copy your API key

### Add to Backend Environment
Add this line to `/backend/.env`:

```env
ALPHA_VANTAGE_API_KEY=your_actual_api_key_here
```

### Alternative: Use Demo Mode
The system will use the demo API key if none is provided, but it has very limited requests (5 per minute, only works with demo symbols).

## 🚀 Running the Application

### Backend
```bash
cd backend
npm install
npm run dev
```

Backend will run on `http://localhost:5000`

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Frontend will run on `http://localhost:5173`

## 📊 Features Available

### 1. Stock Research (`/research`)
- Search any stock symbol (e.g., AAPL, MSFT, GOOGL)
- Get comprehensive AI-powered analysis
- View detailed reports with 8 key sections:
  - Company Overview
  - Current Market Status
  - Buy/Hold/Sell Decision
  - 1-Year Performance
  - Growth Forecast
  - Risk Score (1-10)
  - Investment Type Suitability
  - News & Sentiment

### 2. Watchlist (`/watchlist`)
- Add stocks to your personal watchlist
- Auto-updating buy/hold/sell ratings
- Quick access to full reports
- Refresh analysis for latest data
- Track multiple stocks in one place

### 3. Stock Insights (`/insights`)
- Compare two stocks side-by-side
- See performance differences
- Compare risk levels
- Identify better recommendations

### 4. Enhanced Dashboard (`/`)
- Quick navigation to all features
- Watchlist count display
- Feature overview

## 🧪 Testing the System

### Test Stock Analysis
```bash
# From backend directory
curl -X POST http://localhost:5000/api/stock/analyze \
  -H "Content-Type: application/json" \
  -d '{"symbol":"AAPL"}'
```

### Test Stock Comparison
```bash
curl -X POST http://localhost:5000/api/stock/compare \
  -H "Content-Type: application/json" \
  -d '{"symbol1":"AAPL","symbol2":"MSFT"}'
```

## 📝 Notes

- **API Rate Limits**: Free Alpha Vantage tier has 5 requests/minute and 500 requests/day
- **Caching**: Results are cached for 5 minutes to reduce API calls
- **Demo Symbols**: Use AAPL, MSFT, IBM, GOOGL for testing with demo key
- **Authentication**: Watchlist features require login

## 🎯 Quick Start Workflow

1. **Sign up/Login** to StockCrypt
2. Navigate to **Research** page
3. Enter a stock symbol (e.g., "AAPL")
4. Click **Analyze Stock**
5. Review the comprehensive report
6. Add to **Watchlist** for tracking
7. Use **Insights** to compare with other stocks

## 🐛 Troubleshooting

### "Invalid stock symbol or API limit reached"
- Check if you entered a valid stock symbol
- Verify your API key is set correctly
- You may have hit the rate limit (wait 1 minute)

### "Failed to analyze stock"
- Ensure backend server is running
- Check backend console for errors
- Verify MongoDB connection is active

### Watchlist not loading
- Make sure you're logged in
- Check browser console for errors
- Verify token is valid in localStorage

---

**Ready to analyze stocks!** 🚀📈
