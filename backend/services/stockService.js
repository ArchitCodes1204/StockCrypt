const axios = require('axios');
const NodeCache = require('node-cache');

// Cache for 5 minutes
const cache = new NodeCache({ stdTTL: 300 });

// TwelveData API - Free tier with 800 calls/day
const TWELVE_DATA_KEY = process.env.TWELVE_DATA_API_KEY || 'demo';
const TWELVE_DATA_BASE = 'https://api.twelvedata.com';

// Curated list of popular stocks for the screener
const SCREENER_STOCKS = [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'BRK.B', 'V', 'JNJ',
    'WMT', 'JPM', 'MA', 'PG', 'UNH', 'DIS', 'HD', 'VZ', 'KO', 'PFE',
    'INTC', 'CMCSA', 'PEP', 'CSCO', 'WFC', 'BAC', 'ADBE', 'CRM', 'NFLX', 'AMD'
];

class StockAnalysisService {
    /**
     * Get data for the stock screener (top 30 stocks)
     * Using mock data to ensure reliability and avoid API rate limits
     */
    async getScreenerStocks() {
        try {
            const cacheKey = 'screener_data';
            const cached = cache.get(cacheKey);
            if (cached) return cached;

            // Use mock data for reliable demo - in production, replace with real API calls
            const screenerData = this.getMockScreenerData();

            cache.set(cacheKey, screenerData);
            return screenerData;
        } catch (error) {
            console.error('Screener data fetch error:', error.message);
            return this.getMockScreenerData();
        }
    }

    getMockScreenerData() {
        return SCREENER_STOCKS.map(symbol => ({
            symbol,
            name: `${symbol} Inc.`,
            price: Math.random() * 500 + 50,
            change: (Math.random() - 0.5) * 10,
            changePercent: (Math.random() - 0.5) * 5,
            volume: Math.floor(Math.random() * 100000000),
            marketCap: Math.floor(Math.random() * 1000000000000),
            peRatio: Math.random() * 50 + 10,
            eps: Math.random() * 10,
            fiftyDayAverage: Math.random() * 500,
            twoHundredDayAverage: Math.random() * 500,
            yearHigh: Math.random() * 600,
            yearLow: Math.random() * 300,
            technicalRating: ['Strong Buy', 'Buy', 'Neutral', 'Sell'][Math.floor(Math.random() * 4)]
        }));
    }

    calculateTechnicalRating(quote) {
        const change = parseFloat(quote.percent_change) || 0;
        if (change > 3) return 'Strong Buy';
        if (change > 1) return 'Buy';
        if (change < -3) return 'Sell';
        return 'Neutral';
    }

    /**
     * Analyze a single stock
     */
    async analyzeStock(symbol) {
        try {
            const cacheKey = `analysis_${symbol}`;
            const cached = cache.get(cacheKey);
            if (cached) return cached;

            const url = `${TWELVE_DATA_BASE}/quote?symbol=${symbol}&apikey=${TWELVE_DATA_KEY}`;
            const response = await axios.get(url);
            const quote = response.data;

            if (!quote || !quote.close) {
                throw new Error('Invalid stock symbol or no data available');
            }

            const currentPrice = parseFloat(quote.close);
            const change = parseFloat(quote.change) || 0;
            const changePercent = parseFloat(quote.percent_change) || 0;

            const analysis = {
                symbol: symbol.toUpperCase(),
                companyOverview: {
                    name: quote.name || symbol,
                    description: `Stock analysis for ${quote.name || symbol}`,
                    sector: 'N/A',
                    industry: 'N/A',
                    marketCap: quote.market_cap ? `$${(quote.market_cap / 1e9).toFixed(2)}B` : 'N/A',
                    peRatio: 'N/A'
                },
                currentMarketStatus: {
                    currentPrice: currentPrice.toFixed(2),
                    change: change.toFixed(2),
                    changePercent: `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`,
                    trend: changePercent > 0 ? 'bullish' : changePercent < 0 ? 'bearish' : 'sideways',
                    volume: quote.volume || 'N/A',
                    lastUpdated: quote.datetime || new Date().toLocaleDateString()
                },
                recommendation: this.generateRecommendation(changePercent),
                yearPerformance: this.generateYearPerformance(currentPrice, changePercent, quote),
                growthForecast: this.generateGrowthForecast(changePercent),
                riskScore: this.calculateRiskScore(changePercent),
                investmentType: this.determineInvestmentType(changePercent),
                newsSentiment: this.analyzeSentiment(changePercent),
                timestamp: new Date().toISOString()
            };

            cache.set(cacheKey, analysis);
            return analysis;
        } catch (error) {
            console.error('Stock analysis error:', error.message);
            throw new Error(`Stock analysis failed: ${error.message}`);
        }
    }

    generateRecommendation(changePercent) {
        let decision, confidence, score;
        const reasons = [];

        if (changePercent > 5) {
            decision = 'BUY';
            confidence = 'High';
            score = 3;
            reasons.push('Strong positive momentum');
            reasons.push('Price trending upward');
        } else if (changePercent > 2) {
            decision = 'BUY';
            confidence = 'Moderate';
            score = 2;
            reasons.push('Positive price movement');
        } else if (changePercent < -5) {
            decision = 'SELL';
            confidence = 'High';
            score = -3;
            reasons.push('Significant price decline');
            reasons.push('Negative momentum');
        } else if (changePercent < -2) {
            decision = 'SELL';
            confidence = 'Moderate';
            score = -2;
            reasons.push('Downward price trend');
        } else {
            decision = 'HOLD';
            confidence = 'Moderate';
            score = 0;
            reasons.push('Stable price action');
            reasons.push('Wait for clearer signals');
        }

        return { decision, confidence, score: score.toString(), reasons };
    }

    generateYearPerformance(currentPrice, changePercent, quote) {
        // Use simple estimations based on current price and change percent
        const estimatedYearChange = changePercent * 50; // rough estimate
        const high = currentPrice * 1.15;
        const low = currentPrice * 0.85;
        return {
            percentChange: estimatedYearChange.toFixed(2),
            yearAgoPrice: (currentPrice / (1 + estimatedYearChange / 100)).toFixed(2),
            currentPrice: currentPrice.toFixed(2),
            high: high.toFixed(2),
            low: low.toFixed(2),
            volatilityNote: Math.abs(estimatedYearChange) > 30 ? 'High volatility' : 'Moderate volatility'
        };
    }

    generateGrowthForecast(changePercent) {
        const trend = changePercent > 0 ? 'positive' : 'negative';

        return {
            shortTerm: trend === 'positive'
                ? 'Positive momentum expected to continue in 1-3 months with potential 5-10% gains'
                : 'Cautious outlook for near term, may see 3-5% decline',
            longTerm: Math.abs(changePercent) < 5
                ? 'Stable long-term outlook with moderate growth potential of 15-20% annually'
                : 'Volatile conditions suggest uncertain long-term prospects',
            confidence: Math.abs(changePercent) < 3 ? 'Moderate' : 'Low'
        };
    }

    calculateRiskScore(changePercent) {
        const volatility = Math.abs(changePercent);
        let riskScore = 5;

        if (volatility > 10) riskScore = 8;
        else if (volatility > 5) riskScore = 6;
        else if (volatility > 2) riskScore = 5;
        else riskScore = 3;

        const level = riskScore <= 3 ? 'Low Risk' : riskScore <= 6 ? 'Moderate Risk' : 'High Risk';

        return {
            score: riskScore,
            level,
            factors: [
                `Daily volatility: ${volatility.toFixed(2)}%`,
                `Price momentum: ${changePercent > 0 ? 'Positive' : 'Negative'}`,
                'Market conditions: Normal'
            ]
        };
    }

    determineInvestmentType(changePercent) {
        const volatility = Math.abs(changePercent);

        return [
            {
                type: 'Short-term Traders',
                suitability: volatility > 3 ? 'High' : 'Low',
                reason: volatility > 3 ? 'High volatility creates trading opportunities' : 'Low volatility limits short-term gains'
            },
            {
                type: 'Long-term Investors',
                suitability: volatility < 5 ? 'High' : 'Moderate',
                reason: volatility < 5 ? 'Stable growth potential for long-term holding' : 'Moderate risk requires careful monitoring'
            },
            {
                type: 'High-risk Takers',
                suitability: volatility > 5 ? 'High' : 'Low',
                reason: volatility > 5 ? 'Extreme volatility suits aggressive strategies' : 'Insufficient risk for aggressive traders'
            }
        ];
    }

    analyzeSentiment(changePercent) {
        let sentiment, summary;

        if (changePercent > 3) {
            sentiment = 'positive';
            summary = 'Strong positive momentum suggests bullish market sentiment and investor confidence';
        } else if (changePercent < -3) {
            sentiment = 'negative';
            summary = 'Negative price action indicates bearish sentiment or sector headwinds';
        } else {
            sentiment = 'neutral';
            summary = 'Balanced market sentiment with no strong directional bias';
        }

        return {
            sentiment,
            summary,
            note: 'Sentiment based on price action and technical indicators'
        };
    }

    async compareStocks(symbol1, symbol2) {
        try {
            const [stock1, stock2] = await Promise.all([
                this.analyzeStock(symbol1),
                this.analyzeStock(symbol2)
            ]);

            const getPercentChange = (stock) => {
                return stock.yearPerformance && stock.yearPerformance.percentChange
                    ? parseFloat(stock.yearPerformance.percentChange)
                    : 0;
            };

            const getRiskScore = (stock) => {
                return stock.riskScore && stock.riskScore.score ? stock.riskScore.score : 5;
            };

            const getRecommendation = (stock) => {
                return stock.recommendation && stock.recommendation.decision ? stock.recommendation.decision : 'HOLD';
            };

            return {
                stock1,
                stock2,
                comparison: {
                    performance: {
                        winner: getPercentChange(stock1) > getPercentChange(stock2)
                            ? stock1.symbol : stock2.symbol,
                        difference: Math.abs(
                            getPercentChange(stock1) - getPercentChange(stock2)
                        ).toFixed(2) + '%'
                    },
                    risk: {
                        lowerRisk: getRiskScore(stock1) < getRiskScore(stock2) ? stock1.symbol : stock2.symbol,
                        scoreDifference: Math.abs(getRiskScore(stock1) - getRiskScore(stock2))
                    },
                    recommendation: {
                        stronger: getRecommendation(stock1) === 'BUY' && getRecommendation(stock2) !== 'BUY'
                            ? stock1.symbol :
                            getRecommendation(stock2) === 'BUY' && getRecommendation(stock1) !== 'BUY'
                                ? stock2.symbol : 'Equal'
                    }
                }
            };
        } catch (error) {
            console.error('Comparison error:', error);
            throw new Error('Failed to compare stocks. Please check the symbols and try again.');
        }
    }
}

module.exports = new StockAnalysisService();
