'use client'; // 1. This layout must be a client component
//    because its child <Sidebar /> is a client component.

import Sidebar from '@/app/components/Sidebar'; // 2. Import the Sidebar
import React from 'react';

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* 3. Render the Sidebar here */}
      <Sidebar />

      {/* 4. Add the left padding to a new div that wraps your page */}
      <div className='md:pl-64'>{children}</div>
    </>
  );
}
