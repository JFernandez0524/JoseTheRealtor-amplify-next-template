import { NextResponse } from 'next/server';
import { cookiesClient } from '@/app/utils/aws/auth/amplifyServerUtils.server';

export async function POST(req: Request) {
  try {
    const { ids } = await req.json();
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Invalid ids array' }, { status: 400 });
    }

    // Delete using server-side client with proper auth context
    await Promise.all(
      ids.map((id: string) => cookiesClient.models.PropertyLead.delete({ id }))
    );

    return NextResponse.json({ 
      success: true, 
      deleted: ids.length 
    });
  } catch (error: any) {
    console.error('Bulk delete error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to delete leads' 
    }, { status: 500 });
  }
}
