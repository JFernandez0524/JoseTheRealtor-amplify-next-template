import { updateLead } from '@/app/utils/aws/data/lead.server';

export async function POST(request: Request) {
  try {
    const { leadId, ghlContactId, status } = await request.json();
    
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
  } catch (error) {
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
