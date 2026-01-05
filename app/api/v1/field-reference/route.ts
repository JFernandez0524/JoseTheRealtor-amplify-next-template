import { NextResponse } from 'next/server';

export async function GET() {
  const fieldMappings = {
    // Current field IDs in your code
    'YEJuROSCNnG9OXi3K8lb': 'App Plan',
    'diShiF2bpX7VFql08MVN': 'Account Status', 
    '1NxQW2kKMVgozjSUuu7s': 'AI State',
    'PBInTgsd2nMCD3Ngmy0a': 'Lead Source ID',
    'pGfgxcdFaYAkdq0Vp53j': 'Contact Type',
    
    // Fields I can see in your actual contacts
    'p3NOYiInAERYbe0VsLHB': 'Property Address',
    'h4UIjKQvFu7oRW4SAY8W': 'Property City', 
    '9r9OpQaxYPxqbA6Hvtx7': 'Property State',
    'hgbjsTVwcyID7umdhm2o': 'Property Zip',
    'oaf4wCuM3Ub9eGpiddrO': 'Lead Type',
    '2F48dc4QEAOFHNgBNVcu': 'Owner City',
    '2RCYsC2cztJ1TWTh0tLt': 'Owner Address',
    'Vx4EIVAsIK3ej5jEv3Bm': 'Owner Zip',
    'WzTPYXsXyPcnFSWn2UFf': 'Owner State',
    'HrnY1GUZ7P6d6r7J0ZRc': 'Status'
  };

  return NextResponse.json({
    message: 'Custom Field ID Reference',
    fieldMappings,
    note: 'Check if the field IDs in your code match these actual field IDs from GHL'
  });
}
