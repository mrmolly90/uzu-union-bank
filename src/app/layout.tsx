import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { ToastContainer } from '@/components/ui/Toast';
import Background3D from '@/components/layout/Background3D';
import { AuthSnapshotProvider } from '@/components/layout/AuthSnapshotProvider';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'UZU UNION BANK — Secure Banking. Your Money. Protected.',
  description:
    'Secure digital banking with email, password, and bank-PIN sign-in. Checking, Savings, and Business accounts.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-bybit-bg text-gray-100 antialiased min-h-screen relative">
        <Background3D />
        <AuthSnapshotProvider>
          <div className="relative z-10">
            {children}
          </div>
        </AuthSnapshotProvider>
        <ToastContainer />
        {/* SmartSupp Live Chat Widget */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              var _smartsupp = _smartsupp || {};
              _smartsupp.key = 'd8c5a9c6c4c9b3e7f1a2b4d6e8f0c1a3b5d7e9f2';
              window.smartsupp||(function(d) {
                var s,c,o=smartsupp=function(){ o._.push(arguments)};o._=[];
                s=d.getElementsByTagName('script')[0];c=d.createElement('script');
                c.type='text/javascript';c.charset='utf-8';c.async=true;
                c.src='https://www.smartsuppchat.com/loader.js?';s.parentNode.insertBefore(c,s);
              })(document);
              // Initialize chat with default settings
              smartsupp('chat:set', { 
                email: '',
                name: 'Website Visitor'
              });
            `,
          }}
        />
      </body>
    </html>
  );
}