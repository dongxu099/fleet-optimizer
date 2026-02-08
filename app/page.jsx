'use client';

import { useState, useMemo } from 'react';
import { Database, TrendingDown, AlertTriangle, Zap, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { generateFleetData, calculateFleetStats, PROFILES } from '@/lib/fleetData';
import { generateRecommendations, formatCurrency, getWasteCategory } from '@/lib/optimizationEngine';

/**
 * Simple markdown renderer for AI messages
 */
function renderMarkdown(text) {
    if (!text) return null;

    // Split by double newlines for paragraphs, or by numbered lists
    const lines = text.split('\n');
    const elements = [];
    let currentList = [];
    let listType = null;

    const flushList = () => {
        if (currentList.length > 0) {
            const ListTag = listType === 'ol' ? 'ol' : 'ul';
            elements.push(
                <ListTag key={`list-${elements.length}`} className="ai-list">
                    {currentList.map((item, i) => <li key={i}>{formatInline(item)}</li>)}
                </ListTag>
            );
            currentList = [];
            listType = null;
        }
    };

    // Format inline elements (bold, code, etc.)
    const formatInline = (line) => {
        // Handle **bold**
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i}>{part.slice(2, -2)}</strong>;
            }
            // Handle `code`
            const codeParts = part.split(/(`[^`]+`)/g);
            return codeParts.map((codePart, j) => {
                if (codePart.startsWith('`') && codePart.endsWith('`')) {
                    return <code key={`${i}-${j}`} className="ai-code">{codePart.slice(1, -1)}</code>;
                }
                return codePart;
            });
        });
    };

    lines.forEach((line, idx) => {
        const trimmed = line.trim();

        // Headers
        if (trimmed.startsWith('#### ')) {
            flushList();
            elements.push(<h5 key={idx} className="ai-h4">{formatInline(trimmed.slice(5))}</h5>);
        } else if (trimmed.startsWith('### ')) {
            flushList();
            elements.push(<h4 key={idx} className="ai-h3">{formatInline(trimmed.slice(4))}</h4>);
        } else if (trimmed.startsWith('## ')) {
            flushList();
            elements.push(<h4 key={idx} className="ai-h3">{formatInline(trimmed.slice(3))}</h4>);
        }
        // Numbered list
        else if (/^\d+\.\s/.test(trimmed)) {
            if (listType !== 'ol') flushList();
            listType = 'ol';
            currentList.push(trimmed.replace(/^\d+\.\s/, ''));
        }
        // Bullet list
        else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            if (listType !== 'ul') flushList();
            listType = 'ul';
            currentList.push(trimmed.slice(2));
        }
        // Regular paragraph
        else if (trimmed) {
            flushList();
            elements.push(<p key={idx} className="ai-paragraph">{formatInline(trimmed)}</p>);
        }
    });

    flushList();
    return elements;
}

export default function HomePage() {
    const [activeProfile, setActiveProfile] = useState(null);
    const [fleetData, setFleetData] = useState([]);
    const [sortConfig, setSortConfig] = useState({ key: 'wasteScore', direction: 'desc' });
    const [chatInput, setChatInput] = useState('');
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    // Compute derived data
    const stats = useMemo(() => fleetData.length > 0 ? calculateFleetStats(fleetData) : null, [fleetData]);
    const recommendations = useMemo(() => fleetData.length > 0 ? generateRecommendations(fleetData, 10) : [], [fleetData]);

    // Handle profile selection
    const handleProfileSelect = (profileId) => {
        setActiveProfile(profileId);
        const data = generateFleetData(profileId);
        setFleetData(data);
        setMessages([{
            role: 'assistant',
            content: `Fleet analysis complete! I found ${data.length} tables in your ${profileId} fleet. The top optimization opportunity is **${data[0]?.tableName}** with a waste score of ${Math.round(data[0]?.wasteScore * 100)}%. Would you like me to explain why this table is prioritized?`
        }]);
    };

    // Handle sorting
    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const sortedData = useMemo(() => {
        if (!fleetData.length) return [];
        return [...fleetData].sort((a, b) => {
            const aVal = a[sortConfig.key];
            const bVal = b[sortConfig.key];
            const modifier = sortConfig.direction === 'desc' ? -1 : 1;
            return (aVal > bVal ? 1 : -1) * modifier;
        });
    }, [fleetData, sortConfig]);

    // Handle AI chat
    const handleSendMessage = async () => {
        if (!chatInput.trim() || isLoading) return;

        const userMessage = chatInput;
        setChatInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsLoading(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage,
                    context: {
                        profile: activeProfile,
                        stats,
                        topRecommendations: recommendations.slice(0, 5)
                    }
                })
            });

            const data = await response.json();
            setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
        } catch (error) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.'
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="app-container">
            {/* Navbar */}
            <nav className="navbar">
                <div className="navbar-brand">
                    <div className="navbar-logo">
                        <Database size={20} />
                    </div>
                    <div>
                        <div className="navbar-title">Operational DB Fleet Optimizer</div>
                        <div className="navbar-subtitle">Cost Optimization Prioritizer</div>
                    </div>
                </div>

                <div className="navbar-profiles">
                    {!activeProfile && (
                        <span className="navbar-hint">👉 Click a profile to start:</span>
                    )}
                    {PROFILES.map(profile => (
                        <button
                            key={profile.id}
                            className={`profile-btn ${activeProfile === profile.id ? 'active' : ''}`}
                            onClick={() => handleProfileSelect(profile.id)}
                        >
                            <span className="profile-btn-icon">{profile.icon}</span>
                            {profile.name}
                        </button>
                    ))}
                </div>
            </nav>

            {/* Main Content */}
            <main className="main-content">
                {/* Left Sidebar - Profile Info */}
                <aside className="sidebar-left">
                    <div className="card">
                        <div className="card-header">
                            <span className="card-title">
                                <Zap size={16} /> Quick Actions
                            </span>
                        </div>
                        <div className="card-body">
                            {!activeProfile ? (
                                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                                    Select a simulation profile above to begin fleet analysis.
                                </p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {PROFILES.find(p => p.id === activeProfile) && (
                                        <>
                                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                                <strong style={{ color: 'var(--text-primary)' }}>Profile:</strong> {PROFILES.find(p => p.id === activeProfile).name}
                                            </div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                                {PROFILES.find(p => p.id === activeProfile).description}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </aside>

                {/* Center - Fleet Dashboard */}
                <section className="center-content">
                    {stats && (
                        <div className="stats-row">
                            <div className="stat-card">
                                <div className="stat-value">{stats.totalTables}</div>
                                <div className="stat-label">Total Tables</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-value">{formatCurrency(stats.totalMonthlySpend)}</div>
                                <div className="stat-label">Monthly Spend</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-value savings">{formatCurrency(stats.totalSavingsPotential)}</div>
                                <div className="stat-label">Potential Savings</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-value critical">{stats.criticalTables}</div>
                                <div className="stat-label">Critical Tables</div>
                            </div>
                        </div>
                    )}

                    <div className="card">
                        <div className="card-header">
                            <span className="card-title">
                                <Database size={16} /> Fleet Overview
                            </span>
                            {stats && (
                                <span className="card-badge">{stats.savingsPercentage}% savings potential</span>
                            )}
                        </div>
                        <div className="card-body scroll-container" style={{ padding: 0, maxHeight: '500px' }}>
                            {!activeProfile ? (
                                <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    <Database size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                                    <p>Select a simulation profile to analyze your DynamoDB fleet</p>
                                </div>
                            ) : (
                                <table className="fleet-table">
                                    <thead>
                                        <tr>
                                            <th onClick={() => handleSort('tableName')} className={sortConfig.key === 'tableName' ? 'sorted' : ''}>
                                                Table Name {sortConfig.key === 'tableName' && (sortConfig.direction === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />)}
                                            </th>
                                            <th onClick={() => handleSort('wasteScore')} className={sortConfig.key === 'wasteScore' ? 'sorted' : ''}>
                                                Waste Score {sortConfig.key === 'wasteScore' && (sortConfig.direction === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />)}
                                            </th>
                                            <th onClick={() => handleSort('monthlySpend')} className={sortConfig.key === 'monthlySpend' ? 'sorted' : ''}>
                                                Monthly Cost {sortConfig.key === 'monthlySpend' && (sortConfig.direction === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />)}
                                            </th>
                                            <th onClick={() => handleSort('utilizationPercent')} className={sortConfig.key === 'utilizationPercent' ? 'sorted' : ''}>
                                                Utilization {sortConfig.key === 'utilizationPercent' && (sortConfig.direction === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />)}
                                            </th>
                                            <th>Mode</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedData.slice(0, 20).map(table => (
                                            <tr key={table.id}>
                                                <td>
                                                    <div className="table-name">{table.tableName}</div>
                                                    <div className="table-name-sub">{table.region}</div>
                                                </td>
                                                <td>
                                                    <span className={`waste-badge ${getWasteCategory(table.wasteScore)}`}>
                                                        <span className="waste-dot"></span>
                                                        {Math.round(table.wasteScore * 100)}%
                                                    </span>
                                                </td>
                                                <td className="font-mono">{formatCurrency(table.monthlySpend)}</td>
                                                <td>{table.utilizationPercent}%</td>
                                                <td>
                                                    <span style={{
                                                        fontSize: '11px',
                                                        padding: '4px 8px',
                                                        borderRadius: '4px',
                                                        background: table.capacityMode === 'PROVISIONED' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                                        color: table.capacityMode === 'PROVISIONED' ? 'var(--status-info)' : 'var(--status-good)'
                                                    }}>
                                                        {table.capacityMode === 'PROVISIONED' ? 'Provisioned' : 'On-Demand'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </section>

                {/* Right Sidebar - Recommendations */}
                <aside className="sidebar-right">
                    <div className="card">
                        <div className="card-header">
                            <span className="card-title">
                                <TrendingDown size={16} /> Top 10 Recommendations
                            </span>
                        </div>
                        <div className="card-body scroll-container" style={{ maxHeight: '600px' }}>
                            {recommendations.length === 0 ? (
                                <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
                                    Select a profile to see recommendations
                                </p>
                            ) : (
                                <div className="recommendation-list">
                                    {recommendations.map((rec, index) => (
                                        <div key={rec.tableId} className="rec-card">
                                            <div className="rec-card-header">
                                                <span className="rec-rank">{index + 1}</span>
                                                <span className="rec-savings">-{formatCurrency(rec.totalSavings)}/mo</span>
                                            </div>
                                            <div className="rec-table-name">{rec.tableName}</div>
                                            <div className="rec-action">
                                                <span className="rec-action-icon">{rec.primaryAction.icon}</span>
                                                {rec.primaryAction.title}
                                                <ArrowRight size={12} style={{ marginLeft: 'auto' }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </aside>
            </main>

            {/* AI Assistant Panel */}
            {activeProfile && (
                <div className="ai-panel">
                    <div className="ai-header">
                        <div className="ai-avatar">🤖</div>
                        <div>
                            <div className="ai-title">Fleet Optimization Assistant</div>
                            <div className="ai-status">
                                <span className="ai-status-dot"></span>
                                Online
                            </div>
                        </div>
                    </div>

                    <div className="ai-messages">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`ai-message ${msg.role}`}>
                                {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
                            </div>
                        ))}
                        {isLoading && (
                            <div className="ai-thinking">
                                <div className="ai-thinking-dots">
                                    <span className="ai-thinking-dot"></span>
                                    <span className="ai-thinking-dot"></span>
                                    <span className="ai-thinking-dot"></span>
                                </div>
                                Analyzing fleet data...
                            </div>
                        )}
                    </div>

                    <div className="ai-input-container">
                        <input
                            type="text"
                            className="ai-input"
                            placeholder="Ask about optimization opportunities..."
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        />
                        <button
                            className="ai-send-btn"
                            onClick={handleSendMessage}
                            disabled={isLoading || !chatInput.trim()}
                        >
                            Send
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
