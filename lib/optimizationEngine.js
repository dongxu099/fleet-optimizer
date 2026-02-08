/**
 * Optimization Engine
 * Generates actionable recommendations based on fleet analysis
 */

/**
 * Generate Top N recommendations from fleet data
 */
export function generateRecommendations(tables, limit = 10) {
    const recommendations = [];

    // Sort by savings potential
    const sortedTables = [...tables].sort((a, b) => b.savingsPotential - a.savingsPotential);

    for (const table of sortedTables.slice(0, limit)) {
        const actions = [];

        // Check for capacity mode optimization
        if (table.capacityMode === 'PROVISIONED' && table.trafficPattern === 'SPIKY') {
            actions.push({
                type: 'SWITCH_TO_ONDEMAND',
                title: 'Switch to On-Demand',
                description: `Traffic pattern is ${table.trafficPattern.toLowerCase()}, On-Demand would be more cost-effective`,
                estimatedSavings: Math.round(table.monthlySpend * 0.4),
                priority: 'HIGH',
                icon: '⚡'
            });
        }

        // Check for over-provisioning
        if (table.capacityMode === 'PROVISIONED' && table.utilizationPercent < 30) {
            actions.push({
                type: 'RIGHT_SIZE',
                title: 'Right-size Capacity',
                description: `Only ${table.utilizationPercent}% utilization - reduce provisioned capacity`,
                estimatedSavings: Math.round(table.monthlySpend * (1 - table.utilizationPercent / 100) * 0.5),
                priority: table.utilizationPercent < 15 ? 'HIGH' : 'MEDIUM',
                icon: '📉'
            });
        }

        // Check for unused GSIs
        if (table.unusedGSIs.length > 0) {
            actions.push({
                type: 'REMOVE_GSI',
                title: `Delete ${table.unusedGSIs.length} Unused GSI${table.unusedGSIs.length > 1 ? 's' : ''}`,
                description: `GSIs without recent queries: ${table.unusedGSIs.join(', ')}`,
                estimatedSavings: table.unusedGSIs.length * 50,
                priority: table.unusedGSIs.length >= 2 ? 'HIGH' : 'MEDIUM',
                icon: '🗑️'
            });
        }

        // Check for tables that could use DAX
        if (table.consumedRCU > 5000 && table.trafficPattern === 'STEADY') {
            actions.push({
                type: 'ADD_DAX',
                title: 'Consider DAX Cache',
                description: 'High read throughput with steady pattern - DAX could reduce costs',
                estimatedSavings: Math.round(table.monthlySpend * 0.25),
                priority: 'LOW',
                icon: '🚀'
            });
        }

        if (actions.length > 0) {
            // Get the primary (highest savings) action
            const primaryAction = actions.reduce((max, a) =>
                a.estimatedSavings > max.estimatedSavings ? a : max
            );

            recommendations.push({
                tableId: table.id,
                tableName: table.tableName,
                region: table.region,
                currentSpend: table.monthlySpend,
                wasteScore: table.wasteScore,
                totalSavings: table.savingsPotential,
                primaryAction,
                allActions: actions
            });
        }
    }

    return recommendations;
}

/**
 * Get priority color class
 */
export function getPriorityColor(priority) {
    switch (priority) {
        case 'HIGH': return 'critical';
        case 'MEDIUM': return 'warning';
        case 'LOW': return 'good';
        default: return 'info';
    }
}

/**
 * Format currency
 */
export function formatCurrency(amount) {
    if (amount >= 1000) {
        return `$${(amount / 1000).toFixed(1)}k`;
    }
    return `$${amount}`;
}

/**
 * Get waste score category
 */
export function getWasteCategory(score) {
    if (score >= 0.7) return 'critical';
    if (score >= 0.4) return 'warning';
    return 'good';
}
