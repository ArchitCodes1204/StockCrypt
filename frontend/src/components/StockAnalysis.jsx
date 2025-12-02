import { useState } from 'react';
import PropTypes from 'prop-types';
import './StockAnalysis.css';

const StockAnalysis = ({ analysis, onClose }) => {
    if (!analysis) return null;

    const getRecommendationClass = (decision) => {
        switch (decision) {
            case 'BUY':
                return 'recommendation-buy';
            case 'SELL':
                return 'recommendation-sell';
            case 'HOLD':
            default:
                return 'recommendation-hold';
        }
    };

    const getTrendIcon = (trend) => {
        switch (trend) {
            case 'bullish':
                return '📈';
            case 'bearish':
                return '📉';
            case 'sideways':
            default:
                return '➡️';
        }
    };

    const getSentimentIcon = (sentiment) => {
        switch (sentiment) {
            case 'positive':
                return '😊';
            case 'negative':
                return '😟';
            case 'neutral':
            default:
                return '😐';
        }
    };

    const getRiskColor = (score) => {
        if (score <= 3) return '#4CAF50';
        if (score <= 5) return '#FFC107';
        if (score <= 7) return '#FF9800';
        return '#F44336';
    };

    return (
        <div className="stock-analysis-modal">
            <div className="stock-analysis-container">
                {onClose && (
                    <button className="close-btn" onClick={onClose}>
                        ✕
                    </button>
                )}

                {/* Header */}
                <div className="analysis-header">
                    <h1>{analysis.symbol}</h1>
                    <p className="company-name">{analysis.companyOverview.name}</p>
                </div>

                {/* Company Overview */}
                <section className="analysis-section">
                    <h2>📊 Company Overview</h2>
                    <div className="overview-grid">
                        <div className="overview-item">
                            <span className="label">Sector:</span>
                            <span className="value">{analysis.companyOverview.sector}</span>
                        </div>
                        <div className="overview-item">
                            <span className="label">Industry:</span>
                            <span className="value">{analysis.companyOverview.industry}</span>
                        </div>
                        <div className="overview-item">
                            <span className="label">Market Cap:</span>
                            <span className="value">
                                {analysis.companyOverview.marketCap !== 'N/A'
                                    ? `$${(parseFloat(analysis.companyOverview.marketCap) / 1e9).toFixed(2)}B`
                                    : 'N/A'}
                            </span>
                        </div>
                        <div className="overview-item">
                            <span className="label">P/E Ratio:</span>
                            <span className="value">{analysis.companyOverview.peRatio}</span>
                        </div>
                    </div>
                    <p className="company-description">{analysis.companyOverview.description}</p>
                </section>

                {/* Current Market Status */}
                <section className="analysis-section market-status">
                    <h2>💹 Current Market Status</h2>
                    <div className="status-grid">
                        <div className="status-card">
                            <div className="status-label">Current Price</div>
                            <div className="status-value-large">${analysis.currentMarketStatus.currentPrice}</div>
                            <div className={`status-change ${parseFloat(analysis.currentMarketStatus.change) >= 0 ? 'positive' : 'negative'}`}>
                                {analysis.currentMarketStatus.change} ({analysis.currentMarketStatus.changePercent})
                            </div>
                        </div>
                        <div className="status-card">
                            <div className="status-label">Trend Direction</div>
                            <div className="trend-indicator">
                                <span className="trend-icon">{getTrendIcon(analysis.currentMarketStatus.trend)}</span>
                                <span className="trend-text">{analysis.currentMarketStatus.trend.toUpperCase()}</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Recommendation */}
                <section className="analysis-section recommendation-section">
                    <h2>🎯 Buy / Hold / Sell Decision</h2>
                    <div className={`recommendation-card ${getRecommendationClass(analysis.recommendation.decision)}`}>
                        <div className="recommendation-badge">
                            {analysis.recommendation.decision}
                        </div>
                        <div className="recommendation-confidence">
                            Confidence: {analysis.recommendation.confidence}
                        </div>
                    </div>
                    <div className="recommendation-reasons">
                        <h3>Analysis Factors:</h3>
                        <ul>
                            {analysis.recommendation.reasons.map((reason, index) => (
                                <li key={index}>{reason}</li>
                            ))}
                        </ul>
                    </div>
                </section>

                {/* Year Performance */}
                <section className="analysis-section">
                    <h2>📈 Last 1 Year Performance</h2>
                    <div className="performance-grid">
                        <div className="performance-item highlight">
                            <div className="perf-label">Total Return</div>
                            <div className={`perf-value ${parseFloat(analysis.yearPerformance.percentChange) >= 0 ? 'positive' : 'negative'}`}>
                                {analysis.yearPerformance.percentChange}%
                            </div>
                        </div>
                        <div className="performance-item">
                            <div className="perf-label">52-Week High</div>
                            <div className="perf-value">${analysis.yearPerformance.high}</div>
                        </div>
                        <div className="performance-item">
                            <div className="perf-label">52-Week Low</div>
                            <div className="perf-value">${analysis.yearPerformance.low}</div>
                        </div>
                    </div>
                    <div className="volatility-note">
                        <strong>Volatility Assessment:</strong> {analysis.yearPerformance.volatilityNote}
                    </div>
                </section>

                {/* Growth Forecast */}
                <section className="analysis-section">
                    <h2>🔮 Growth Forecast & Future Prediction</h2>
                    <div className="forecast-container">
                        <div className="forecast-card">
                            <h3>Short-term (1-3 months)</h3>
                            <p>{analysis.growthForecast.shortTerm}</p>
                        </div>
                        <div className="forecast-card">
                            <h3>Long-term (1-2 years)</h3>
                            <p>{analysis.growthForecast.longTerm}</p>
                        </div>
                    </div>
                    <div className="forecast-confidence">
                        Forecast Confidence: <strong>{analysis.growthForecast.confidence}</strong>
                    </div>
                </section>

                {/* Risk Score */}
                <section className="analysis-section risk-section">
                    <h2>⚠️ Risk Score</h2>
                    <div className="risk-meter-container">
                        <div className="risk-score-display">
                            <div
                                className="risk-score-number"
                                style={{ color: getRiskColor(analysis.riskScore.score) }}
                            >
                                {analysis.riskScore.score}/10
                            </div>
                            <div className="risk-level">{analysis.riskScore.level}</div>
                        </div>
                        <div className="risk-meter">
                            {[...Array(10)].map((_, i) => (
                                <div
                                    key={i}
                                    className={`risk-bar ${i < analysis.riskScore.score ? 'active' : ''}`}
                                    style={{
                                        backgroundColor: i < analysis.riskScore.score ? getRiskColor(i + 1) : '#e0e0e0'
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                    <div className="risk-factors">
                        <h3>Risk Factors:</h3>
                        <ul>
                            {analysis.riskScore.factors.map((factor, index) => (
                                <li key={index}>{factor}</li>
                            ))}
                        </ul>
                    </div>
                </section>

                {/* Investment Type Suitability */}
                <section className="analysis-section">
                    <h2>👥 Investment Type Suitability</h2>
                    <div className="suitability-grid">
                        {analysis.investmentType.map((item, index) => (
                            <div key={index} className="suitability-card">
                                <div className="suitability-type">{item.type}</div>
                                <div className={`suitability-badge suitability-${item.suitability.toLowerCase()}`}>
                                    {item.suitability}
                                </div>
                                <div className="suitability-reason">{item.reason}</div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* News & Sentiment */}
                <section className="analysis-section">
                    <h2>📰 News & Sentiment Summary</h2>
                    <div className="sentiment-container">
                        <div className="sentiment-badge">
                            <span className="sentiment-icon">{getSentimentIcon(analysis.newsSentiment.sentiment)}</span>
                            <span className="sentiment-text">
                                {analysis.newsSentiment.sentiment.toUpperCase()}
                            </span>
                        </div>
                        <p className="sentiment-summary">{analysis.newsSentiment.summary}</p>
                        <p className="sentiment-note">
                            <em>{analysis.newsSentiment.note}</em>
                        </p>
                    </div>
                </section>

                {/* Final Verdict */}
                <section className="final-verdict">
                    <h2>⭐ FINAL VERDICT</h2>
                    <div className={`verdict-box ${getRecommendationClass(analysis.recommendation.decision)}`}>
                        <div className="verdict-recommendation">
                            {analysis.recommendation.decision}
                        </div>
                        <div className="verdict-summary">
                            Based on technical analysis, {analysis.symbol} shows a{' '}
                            <strong>{analysis.currentMarketStatus.trend}</strong> trend with{' '}
                            <strong>{analysis.riskScore.level.toLowerCase()}</strong>.
                            The stock is {analysis.recommendation.decision === 'BUY' ? 'recommended for purchase' :
                                analysis.recommendation.decision === 'SELL' ? 'recommended for sale' :
                                    'suggested to be held'} with{' '}
                            <strong>{analysis.recommendation.confidence.toLowerCase()} confidence</strong>.
                        </div>
                    </div>
                </section>

                <div className="analysis-timestamp">
                    Analysis generated on: {new Date(analysis.timestamp).toLocaleString()}
                </div>
            </div>
        </div>
    );
};

StockAnalysis.propTypes = {
    analysis: PropTypes.object,
    onClose: PropTypes.func
};

export default StockAnalysis;
