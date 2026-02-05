import { updateLead } from '@/app/utils/aws/data/lead.server';

export async function POST(request: Request) {
  try {
    const { leadId, ghlContactId, status, adminKey } = await request.json();
    
    // Simple admin bypass (use a secret key)
    if (adminKey !== 'ghl-admin-2026') {
      return Response.json({ 
        success: false, 
        error: 'Admin key required' 
      }, { status: 401 });
    }
    
    const updates: any = { ghlSyncStatus: status };
    if (ghlContactId) {
      updates.ghlContactId = ghlContactId;
    }
    
    const updatedLead = await updateLead({ id: leadId, ...updates });
    
    return Response.json({ 
      success: true, 
      message: `Updated lead ${leadId} to ${status}`,
      lead: updatedLead 
    });
  } catch (error: any) {
    return Response.json({ 
      success: false, 
      error: error?.message || 'Unknown error'
    }, { status: 500 });
  }
}
