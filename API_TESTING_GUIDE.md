# 🚀 Quick API Testing Guide

## Test All CRUD Operations

### 1. CREATE Operations

#### Add to Watchlist
```bash
curl -X POST http://localhost:5001/api/stock/watchlist \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"symbol":"AAPL","notes":"Great company"}'
```

#### Analyze Stock
```bash
curl -X POST http://localhost:5001/api/stock/analyze \
  -H "Content-Type: application/json" \
  -d '{"symbol":"MSFT"}'
```

### 2. READ Operations

#### Get Watchlist
```bash
curl -X GET http://localhost:5001/api/stock/watchlist \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Get Trending Stocks
```bash
curl -X GET http://localhost:5001/api/stock/trending
```

### 3. UPDATE Operations

#### Refresh Stock Analysis
```bash
curl -X PUT http://localhost:5001/api/stock/watchlist/AAPL/refresh \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 4. DELETE Operations

#### Remove from Watchlist
```bash
curl -X DELETE http://localhost:5001/api/stock/watchlist/AAPL \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Browser Testing (Recommended)

### Step 1: Login
1. Open http://localhost:5173
2. Create account or login
3. Open DevTools (F12) → Network tab → Filter: XHR

### Step 2: Test CREATE
1. Go to Research page
2. Search "AAPL" → Click Analyze
3. Check Network tab: `POST /api/stock/analyze`
4. Click "Add to Watchlist"
5. Check Network tab: `POST /api/stock/watchlist`

### Step 3: Test READ
1. Go to Watchlist page
2. Check Network tab: `GET /api/stock/watchlist`
3. Verify stocks displayed

### Step 4: Test UPDATE
1. On Watchlist, click refresh icon
2. Check Network tab: `PUT /api/stock/watchlist/:symbol/refresh`
3. Verify data updates

### Step 5: Test DELETE
1. Click remove button on any stock
2. Check Network tab: `DELETE /api/stock/watchlist/:symbol`
3. Verify stock removed

---

## Database Verification

### MongoDB Atlas
1. Login to MongoDB Atlas
2. Go to Collections
3. Select `stocks` collection
4. Perform operations in app
5. Refresh database view
6. Verify changes

---

## Expected Responses

### Success Responses
- CREATE: `201 Created` with new object
- READ: `200 OK` with data array/object
- UPDATE: `200 OK` with updated object
- DELETE: `200 OK` with success message

### Error Responses
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - No/invalid token
- `404 Not Found` - Resource doesn't exist
- `500 Server Error` - Server issue

---

## Quick Test Checklist

- [ ] Backend running on port 5001
- [ ] Frontend running on port 5173
- [ ] MongoDB connected
- [ ] Can signup/login
- [ ] Can analyze stock (CREATE)
- [ ] Can view watchlist (READ)
- [ ] Can refresh stock (UPDATE)
- [ ] Can remove stock (DELETE)
- [ ] All responses in Network tab
- [ ] Database entries verified

---

**All tests passing?** ✅ Ready for deployment!
