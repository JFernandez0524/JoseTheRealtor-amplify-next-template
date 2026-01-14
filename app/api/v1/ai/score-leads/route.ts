import { NextRequest, NextResponse } from 'next/server';
import { AuthIsUserAuthenticatedServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { calculateLeadScore } from '@/app/utils/ai/leadScoring';
import { cookiesClient } from '@/app/utils/aws/auth/amplifyServerUtils.server';

export async function POST(request: NextRequest) {
  try {
    const isAuthenticated = await AuthIsUserAuthenticatedServer();
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { leadIds } = await request.json();

    if (!leadIds || !Array.isArray(leadIds)) {
      return NextResponse.json(
        { error: 'leadIds array required' },
        { status: 400 }
      );
    }

    // Fetch leads and calculate scores
    const results = await Promise.all(
      leadIds.map(async (id: string) => {
        try {
          const { data: lead } = await cookiesClient.models.PropertyLead.get({ id });
          if (!lead) return null;

          const scoreData = calculateLeadScore(lead);

          // Update lead with AI score
          await cookiesClient.models.PropertyLead.update({
            id,
            aiScore: scoreData.score,
            aiPriority: scoreData.priority,
            aiInsights: scoreData.insights,
            aiLastCalculated: new Date().toISOString(),
          });

          return { id, score: scoreData.score, priority: scoreData.priority };
        } catch (err) {
          console.error(`Failed to score lead ${id}:`, err);
          return null;
        }
      })
    );

    const successful = results.filter(r => r !== null);

    return NextResponse.json({
      success: true,
      scored: successful.length,
      total: leadIds.length,
    });
  } catch (error: any) {
    console.error('AI scoring error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate AI scores' },
      { status: 500 }
    );
  }
}
