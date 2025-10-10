'use client';

import { useState, useEffect } from 'react';

import './../app/app.css';
import { Amplify } from 'aws-amplify';
import outputs from '@/amplify_outputs.json';
import '@aws-amplify/ui-react/styles.css';

export default function App() {
  return (
    <main>
      <div>
        🥳 App successfully hosted. Try creating a new todo.
        <br />
        <a href='https://docs.amplify.aws/nextjs/start/quickstart/nextjs-app-router-client-components/'>
          Review next steps of this tutorial.
        </a>
      </div>
    </main>
  );
}
