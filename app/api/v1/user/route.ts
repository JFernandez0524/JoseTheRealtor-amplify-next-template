import { NextResponse } from 'next/server';
import { AuthGetCurrentUserServer } from '../../../../src/utils/amplifyServerUtils.server';

export async function GET() {
  try {
    const user = await AuthGetCurrentUserServer();
    if (!user)
      return NextResponse.json(
        { message: 'Not authenticated' },
        { status: 401 }
      );
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }
}
