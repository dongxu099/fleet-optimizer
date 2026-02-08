import OpenAI from 'openai';

const SYSTEM_PROMPT = `You are a Senior Solutions Architect specializing in Amazon DynamoDB optimization. You're helping analyze a simulated fleet of DynamoDB tables to identify cost-saving opportunities.

Your expertise includes:
- Capacity Mode Selection (Provisioned vs On-Demand)
- Read/Write Capacity Unit optimization
- Global Secondary Index (GSI) management
- Traffic pattern analysis (Steady, Spiky, Bursty)
- DAX caching recommendations
- Partition key design and hot partition prevention

When responding:
1. Be concise but insightful
2. Reference specific tables from the fleet context when applicable
3. Provide actionable recommendations
4. Quantify savings potential when possible
5. Explain the "why" behind each recommendation

Format your responses in markdown for clarity.`;

// Lazy initialization to avoid build-time errors
let openaiClient = null;

function getOpenAIClient() {
    if (!openaiClient) {
        openaiClient = new OpenAI({
            baseURL: 'https://space.ai-builders.com/backend/v1',
            apiKey: process.env.AI_BUILDER_TOKEN,
        });
    }
    return openaiClient;
}

export async function POST(request) {
    try {
        const { message, context } = await request.json();

        // Build context string from fleet data
        let contextInfo = '';
        if (context) {
            contextInfo = `\n\nCurrent Fleet Context:
- Profile: ${context.profile}
- Total Tables: ${context.stats?.totalTables || 'N/A'}
- Monthly Spend: $${context.stats?.totalMonthlySpend || 'N/A'}
- Savings Potential: $${context.stats?.totalSavingsPotential || 'N/A'}
- Critical Tables: ${context.stats?.criticalTables || 'N/A'}

Top 5 Optimization Targets:
${context.topRecommendations?.map((rec, i) =>
                `${i + 1}. ${rec.tableName}: ${rec.primaryAction?.title} (Save $${rec.totalSavings}/mo)`
            ).join('\n') || 'No recommendations yet'}`;
        }

        const openai = getOpenAIClient();
        const completion = await openai.chat.completions.create({
            model: 'grok-4-fast',
            messages: [
                {
                    role: 'system',
                    content: SYSTEM_PROMPT + contextInfo
                },
                {
                    role: 'user',
                    content: message
                }
            ],
            max_tokens: 500,
            temperature: 0.7
        });

        const reply = completion.choices[0]?.message?.content || 'I apologize, I could not generate a response.';

        return Response.json({ reply });
    } catch (error) {
        console.error('Chat API Error:', error);
        return Response.json(
            { reply: 'Sorry, there was an error processing your request. Please try again.' },
            { status: 500 }
        );
    }
}
