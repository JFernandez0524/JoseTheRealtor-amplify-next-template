import '@aws-amplify/ui-react/styles.css';
import './globals.css';
import { Inter } from 'next/font/google';
import AuthProvider from './components/AuthProvider';
import Navbar from './components/Navbar';
import { ConversationsProvider } from './context/ConversationsContext';
import { AccessProvider } from './context/AccessContext';
import { GhlProvider } from './context/GhlContext';
import SessionTimeout from './components/SessionTimeout';

const inter = Inter({ subsets: ['latin'] });

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

  return (
    <html lang='en'>
      <head>
        {GTM_ID && (
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`,
            }}
          />
        )}
      </head>
      <body className={inter.className}>
        {GTM_ID && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
        )}
        <AuthProvider>
          <AccessProvider>
            <GhlProvider>
              <ConversationsProvider>
                <SessionTimeout />
                <Navbar />
                {children}
                <footer className='bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 border-t border-gray-200'>
                  <div className='max-w-7xl mx-auto text-center'>
                    <p className='text-gray-600 mb-4'>
                      © {new Date().getFullYear()} JoseTheRealtor.com - Streamlining Real Estate Lead Management
                    </p>
                    <div className='flex justify-center flex-wrap gap-x-6 gap-y-2 text-sm'>
                      <a href='/terms-of-service' className='text-gray-500 hover:text-gray-700 transition-colors'>
                        Terms of Service
                      </a>
                      <a href='/privacy-policy' className='text-gray-500 hover:text-gray-700 transition-colors'>
                        Privacy Policy
                      </a>
                      <a href='/cookie-policy' className='text-gray-500 hover:text-gray-700 transition-colors'>
                        Cookie Policy
                      </a>
                      <a href='/tcpa-compliance' className='text-gray-500 hover:text-gray-700 transition-colors'>
                        TCPA Compliance
                      </a>
                      <a href='/compliance' className='text-gray-500 hover:text-gray-700 transition-colors'>
                        Compliance Hub
                      </a>
                    </div>
                  </div>
                </footer>
              </ConversationsProvider>
            </GhlProvider>
          </AccessProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
