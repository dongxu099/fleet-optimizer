/**
 * DynamoDB Fleet Data Generator
 * Generates realistic simulated fleet data for different industry profiles
 */

// Table name prefixes by category
const TABLE_PREFIXES = {
    ecommerce: ['orders', 'products', 'users', 'carts', 'inventory', 'reviews', 'payments', 'shipments', 'promotions', 'sessions', 'wishlists', 'returns'],
    gaming: ['players', 'sessions', 'leaderboards', 'achievements', 'inventory', 'matches', 'guilds', 'chat', 'events', 'purchases', 'stats'],
    financial: ['accounts', 'transactions', 'audit', 'compliance', 'customers', 'loans', 'cards', 'alerts', 'reports', 'kyc', 'fraud', 'statements']
};

const ENVIRONMENTS = ['prod', 'staging', 'dev', 'test'];
const REGIONS = ['us-east-1', 'us-west-2', 'eu-west-1'];

// GSI names that might be unused
const UNUSED_GSI_NAMES = [
    'gsi-legacy-idx', 'gsi-migration-temp', 'gsi-old-format', 'gsi-deprecated',
    'gsi-test-idx', 'gsi-backup-idx', 'gsi-unused-sort', 'gsi-archive-idx'
];

/**
 * Generate a random number within a range
 */
function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a single table's metadata
 */
function generateTable(prefix, env, index, profileType) {
    const isProvisioned = Math.random() > 0.3; // 70% provisioned
    const isHighTraffic = Math.random() > 0.6;

    // Base capacity values
    let provisionedRCU, provisionedWCU, consumedRCU, consumedWCU;

    if (isHighTraffic) {
        provisionedRCU = randomBetween(2000, 10000);
        provisionedWCU = randomBetween(500, 3000);
    } else {
        provisionedRCU = randomBetween(100, 2000);
        provisionedWCU = randomBetween(50, 500);
    }

    // Utilization patterns vary by profile
    let utilizationFactor;
    switch (profileType) {
        case 'ecommerce':
            // E-commerce: some tables very underutilized (seasonal)
            utilizationFactor = Math.random() > 0.7 ? randomBetween(5, 30) / 100 : randomBetween(40, 90) / 100;
            break;
        case 'gaming':
            // Gaming: very uneven - some hot, some cold
            utilizationFactor = Math.random() > 0.5 ? randomBetween(70, 95) / 100 : randomBetween(10, 40) / 100;
            break;
        case 'financial':
            // Financial: typically over-provisioned for safety
            utilizationFactor = randomBetween(15, 50) / 100;
            break;
        default:
            utilizationFactor = randomBetween(20, 80) / 100;
    }

    consumedRCU = Math.floor(provisionedRCU * utilizationFactor);
    consumedWCU = Math.floor(provisionedWCU * utilizationFactor);

    // GSI analysis
    const totalGSIs = randomBetween(0, 5);
    const unusedGSIs = [];
    if (totalGSIs > 0 && Math.random() > 0.5) {
        const numUnused = randomBetween(1, Math.min(3, totalGSIs));
        for (let i = 0; i < numUnused; i++) {
            unusedGSIs.push(UNUSED_GSI_NAMES[randomBetween(0, UNUSED_GSI_NAMES.length - 1)]);
        }
    }

    // Traffic pattern
    const patterns = ['STEADY', 'SPIKY', 'BURSTY'];
    const trafficPattern = patterns[randomBetween(0, 2)];

    // Calculate costs (simplified On-Demand pricing us-east-1)
    const rcuCostPerMillion = 0.25;
    const wcuCostPerMillion = 1.25;
    const monthlyHours = 730;

    let monthlySpend;
    if (isProvisioned) {
        // Provisioned: pay for provisioned capacity
        monthlySpend = (provisionedRCU * 0.00013 + provisionedWCU * 0.00065) * monthlyHours;
    } else {
        // On-demand: pay for consumed
        monthlySpend = (consumedRCU * rcuCostPerMillion / 1000000 * 3600 * monthlyHours) +
            (consumedWCU * wcuCostPerMillion / 1000000 * 3600 * monthlyHours);
    }

    // Calculate waste score (0-1, higher = more waste)
    const capacityWaste = isProvisioned ? (1 - utilizationFactor) : 0;
    const gsiWaste = unusedGSIs.length > 0 ? 0.15 * unusedGSIs.length : 0;
    const modeWaste = isProvisioned && trafficPattern === 'SPIKY' ? 0.2 : 0;

    const wasteScore = Math.min(1, capacityWaste * 0.6 + gsiWaste + modeWaste);

    // Calculate savings potential
    let savingsPotential = 0;

    // Potential from switching to On-Demand for spiky tables
    if (isProvisioned && trafficPattern === 'SPIKY') {
        savingsPotential += monthlySpend * 0.4;
    }

    // Potential from right-sizing
    if (capacityWaste > 0.5) {
        savingsPotential += monthlySpend * capacityWaste * 0.5;
    }

    // Potential from removing unused GSIs
    savingsPotential += unusedGSIs.length * 50; // ~$50/month per unused GSI

    const tableName = `${prefix}-${env}-${String(index).padStart(2, '0')}`;

    return {
        id: `tbl-${Date.now()}-${index}`,
        tableName,
        region: REGIONS[randomBetween(0, REGIONS.length - 1)],
        environment: env,
        capacityMode: isProvisioned ? 'PROVISIONED' : 'ON_DEMAND',
        provisionedRCU: isProvisioned ? provisionedRCU : null,
        provisionedWCU: isProvisioned ? provisionedWCU : null,
        consumedRCU,
        consumedWCU,
        utilizationPercent: Math.round(utilizationFactor * 100),
        gsiCount: totalGSIs,
        unusedGSIs,
        trafficPattern,
        monthlySpend: Math.round(monthlySpend),
        wasteScore: Math.round(wasteScore * 100) / 100,
        savingsPotential: Math.round(savingsPotential),
        lastUpdated: new Date().toISOString()
    };
}

/**
 * Generate fleet data for a specific profile
 */
export function generateFleetData(profileType) {
    const prefixes = TABLE_PREFIXES[profileType] || TABLE_PREFIXES.ecommerce;
    const tables = [];

    let tableCount;
    switch (profileType) {
        case 'ecommerce':
            tableCount = 70;
            break;
        case 'gaming':
            tableCount = 45;
            break;
        case 'financial':
            tableCount = 90;
            break;
        default:
            tableCount = 50;
    }

    for (let i = 0; i < tableCount; i++) {
        const prefix = prefixes[i % prefixes.length];
        const env = i < tableCount * 0.6 ? 'prod' : ENVIRONMENTS[randomBetween(0, ENVIRONMENTS.length - 1)];
        tables.push(generateTable(prefix, env, i + 1, profileType));
    }

    // Sort by waste score descending
    tables.sort((a, b) => b.wasteScore - a.wasteScore);

    return tables;
}

/**
 * Generate fleet summary statistics
 */
export function calculateFleetStats(tables) {
    const totalTables = tables.length;
    const totalMonthlySpend = tables.reduce((sum, t) => sum + t.monthlySpend, 0);
    const totalSavingsPotential = tables.reduce((sum, t) => sum + t.savingsPotential, 0);
    const criticalTables = tables.filter(t => t.wasteScore >= 0.7).length;
    const avgUtilization = Math.round(tables.reduce((sum, t) => sum + t.utilizationPercent, 0) / totalTables);
    const unusedGSICount = tables.reduce((sum, t) => sum + t.unusedGSIs.length, 0);

    return {
        totalTables,
        totalMonthlySpend,
        totalSavingsPotential,
        criticalTables,
        avgUtilization,
        unusedGSICount,
        savingsPercentage: Math.round((totalSavingsPotential / totalMonthlySpend) * 100)
    };
}

/**
 * Profile definitions for the selector
 */
export const PROFILES = [
    {
        id: 'ecommerce',
        name: 'E-commerce Fleet',
        icon: '🛒',
        description: '70 tables, seasonal traffic patterns',
        tableCount: 70
    },
    {
        id: 'gaming',
        name: 'Gaming Backend',
        icon: '🎮',
        description: '45 tables, uneven load distribution',
        tableCount: 45
    },
    {
        id: 'financial',
        name: 'Financial Services',
        icon: '🏦',
        description: '90 tables, conservative provisioning',
        tableCount: 90
    }
];
