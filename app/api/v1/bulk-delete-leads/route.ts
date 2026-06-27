/**
 * POST /api/v1/bulk-delete-leads
 *
 * Permanently deletes one or more PropertyLead records from DynamoDB.
 *
 * AUTH: Required (Cognito JWT via cookies)
 * REQUEST BODY: { ids: string[] }
 * RESPONSE: { success: true, deleted: number }
 *
 * NOTE: Deletion is irreversible. The caller is responsible for any GHL cleanup.
 */
import { NextResponse } from 'next/server';
import { cookiesClient } from '@/app/utils/aws/auth/amplifyServerUtils.server';

export async function POST(req: Request) {
  try {
    const { ids } = await req.json();
    
    console.log('🗑️ Bulk delete API called with ids:', ids);
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      console.error('❌ Invalid ids array:', ids);
      return NextResponse.json({ error: 'Invalid ids array' }, { status: 400 });
    }

    console.log(`🗑️ Deleting ${ids.length} leads...`);
    
    // Delete using server-side client with proper auth context
    const results = await Promise.all(
      ids.map(async (id: string) => {
        try {
          const result = await cookiesClient.models.PropertyLead.delete({ id });
          if (result.errors?.length) {
            throw new Error(result.errors.map((e: any) => e.message).join(', '));
          }
          return result;
        } catch (err) {
          console.error(`❌ Failed to delete lead ${id}:`, err);
          throw err;
        }
      })
    );

    console.log(`✅ Successfully deleted ${ids.length} leads`);
    
    return NextResponse.json({ 
      success: true, 
      deleted: ids.length 
    });
  } catch (error: any) {
    console.error('❌ Bulk delete error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to delete leads' 
    }, { status: 500 });
  }
}
