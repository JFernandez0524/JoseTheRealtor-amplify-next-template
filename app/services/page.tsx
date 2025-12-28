// amplify/services/page.tsx

export default async function ServicesPage() {
  return (
    <main className='max-w-4xl mx-auto py-20 px-6'>
      <div className='text-center mb-16'>
        <h1 className='text-5xl font-black text-slate-900 mb-4 tracking-tight'>
          Our Services
        </h1>
        <p className='text-slate-600 font-medium'>
          Professional lead management and data enrichment for real estate
          investors.
        </p>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-3 gap-8'>
        <div className='bg-white p-8 rounded-3xl border border-slate-200 shadow-sm'>
          <h3 className='font-bold text-xl mb-3 text-indigo-600'>
            Lead Management
          </h3>
          <p className='text-slate-600 text-sm leading-relaxed'>
            Upload and organize your leads. Our system handles probate and
            pre-foreclosure data processing automatically.
          </p>
        </div>

        <div className='bg-white p-8 rounded-3xl border border-slate-200 shadow-sm'>
          <h3 className='font-bold text-xl mb-3 text-blue-600'>
            Data Validation
          </h3>
          <p className='text-slate-600 text-sm leading-relaxed'>
            Automated address validation ensures your mailers and outreach hit
            the right targets every time.
          </p>
        </div>

        <div className='bg-white p-8 rounded-3xl border border-slate-200 shadow-sm'>
          <h3 className='font-bold text-xl mb-3 text-purple-600'>
            Skip Tracing
          </h3>
          <p className='text-slate-600 text-sm leading-relaxed'>
            Unlock owner contact information with our integrated skip-tracing
            service at competitive rates.
          </p>
        </div>
      </div>
    </main>
  );
}
