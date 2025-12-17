// app/components/shared/LoadingOverlay.tsx
'use client';

import { Flex, Loader, View } from '@aws-amplify/ui-react';

export default function LoadingOverlay() {
  return (
    <View
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Flex direction='column' alignItems='center' gap='1rem'>
        <Loader size='large' />
        <span className='text-sm font-medium text-gray-600'>
          Loading lead data...
        </span>
      </Flex>
    </View>
  );
}
