import { NextResponse } from 'next/server';
import { getContacts } from '@/app/utils/kvcore.server';

export async function GET() {
  const contacts = await getContacts({ perPage: 5 });
  
  if (contacts) {
    return NextResponse.json({
      success: true,
      total: contacts.total,
      contacts: contacts.data
    });
  }
  
  return NextResponse.json({
    success: false,
    error: 'Failed to fetch contacts'
  }, { status: 500 });
}
