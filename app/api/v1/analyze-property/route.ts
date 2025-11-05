// app/api/analyze-property/route.ts (Example usage)
import { analyzeBridgeProperty } from '@/app/utils/bridge.server';
import { validateAddressWithGoogle } from '@/app/utils/google.server'; // 👈 Import it
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { address } = await request.json();
  // ... (check for address) ...

  try {
    // --- Step 1: Validate the address ---
    const validation = await validateAddressWithGoogle(address);
    console.log(validation);

    // You could stop here if it's a bad address
    // if (validation.isPartialMatch) { ... }

    // --- Step 2: Call your library ---
    // Pass the *validated* address to Bridge
    const analysis = await analyzeBridgeProperty(validation.formattedAddress);

    // --- Step 3: Return the result ---
    return NextResponse.json({ success: true, ...analysis });
  } catch (error: any) {
    // ... (catch errors)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
  // ... (catch errors)
}
