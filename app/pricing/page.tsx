'use client';

import BuyCreditsButton from '../components/pricing/BuyCreditsButton';
import {
  HiCheck,
  HiPhone,
  HiEnvelope,
  HiHome,
  HiUsers,
  HiSparkles,
  HiBolt,
  HiShieldCheck,
  HiMagnifyingGlass,
  HiArrowRight,
} from 'react-icons/hi2';

export default function PricingPage() {
  const skipPackages = [
    {
      credits: 100,
      price: '$10',
      perCredit: '$0.10',
      packId: '100',
      name: 'Starter Pack',
      description: 'Ideal for trying out skip tracing or reaching a targeted neighborhood list.',
      badge: null,
      features: [
        '100 full property records',
        'Verified mobile & landline numbers',
        'Validated email addresses',
        'Current mailing & absentee addresses',
        'Credits never expire',
        'Instant balance update',
      ],
    },
    {
      credits: 250,
      price: '$25',
      perCredit: '$0.10',
      packId: '250',
      name: 'Growth Pack',
      description: 'Our most popular pack for active weekly outreach and consistent deal flow.',
      badge: 'MOST POPULAR',
      features: [
        '250 full property records',
        'Verified mobile & landline numbers',
        'Validated email addresses',
        'Current mailing & absentee addresses',
        'Spouse & relative contact info',
        'Bulk CSV import ready',
        'Credits never expire',
      ],
    },
    {
      credits: 500,
      price: '$50',
      perCredit: '$0.10',
      packId: '500',
      name: 'Power Pack',
      description: 'Built for high-volume investors running large campaigns and county-wide lists.',
      badge: 'BEST VALUE',
      features: [
        '500 full property records',
        'Verified mobile & landline numbers',
        'Validated email addresses',
        'Current mailing & absentee addresses',
        'Spouse & relative contact info',
        'Bulk CSV import ready',
        'Priority data lookup speed',
        'Credits never expire',
      ],
    },
  ];

  const dataFields = [
    {
      icon: HiPhone,
      iconBg: 'bg-blue-100 text-blue-600',
      title: 'Mobile & Landline Numbers',
      description:
        'Direct cell phones and landlines flagged by carrier type (Mobile vs. Landline) and DNC registry status so you always call or text compliantly.',
    },
    {
      icon: HiEnvelope,
      iconBg: 'bg-emerald-100 text-emerald-600',
      title: 'Verified Email Addresses',
      description:
        'Active personal and business email addresses pre-screened for deliverability so your cold emails land in the primary inbox, not spam.',
    },
    {
      icon: HiHome,
      iconBg: 'bg-purple-100 text-purple-600',
      title: 'Current Mailing Address',
      description:
        'The owner’s true current residence. This is critical for absentee owners and out-of-state landlords who don’t live at the property address.',
    },
    {
      icon: HiUsers,
      iconBg: 'bg-amber-100 text-amber-600',
      title: 'Relatives & Co-Owners',
      description:
        'Names and phone numbers of spouses, heirs, or co-owners, giving you alternative ways to reach someone if the primary owner is unavailable.',
    },
  ];

  const steps = [
    {
      step: '1',
      title: 'Pick or Import a Property',
      description: 'Type in any single property address or upload hundreds of leads at once using our CSV importer.',
    },
    {
      step: '2',
      title: 'Run Instant Skip Trace',
      description: 'Our digital detective scans county tax deeds and nationwide telecom records in under two seconds.',
    },
    {
      step: '3',
      title: 'Connect & Close Deals',
      description: 'Instantly view verified phone numbers and emails to start calls, automated emails, or direct mail.',
    },
  ];

  const faqs = [
    {
      q: 'How many property leads do I get per credit?',
      a: 'Exactly 1 credit = 1 full property record. You get all phone numbers (mobile and landline), emails, mailing addresses, and associated relative contacts found for that owner without paying anything extra.',
    },
    {
      q: 'Do skip tracing credits expire?',
      a: 'Never! Your purchased credits stay in your account forever until you use them. There are no monthly resets or use-it-or-lose-it deadlines.',
    },
    {
      q: 'Is there a monthly subscription fee required?',
      a: 'No monthly subscription is required. We operate on a 100% pay-as-you-go credit model so you only pay for the leads you need.',
    },
    {
      q: 'Can I skip trace bulk CSV lists?',
      a: 'Yes! You can upload a spreadsheet of property addresses and bulk skip trace them in one click. Credits are automatically deducted from your balance as records are enriched.',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50 py-8 px-4 sm:py-14 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-16 sm:space-y-20">
        {/* Header Hero */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold bg-blue-50 text-blue-700 border border-blue-200 mb-4">
            <HiSparkles className="w-4 h-4 text-blue-600" />
            <span>Pay-As-You-Go • No Monthly Subscription</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 tracking-tight mb-4">
            Skip Tracing Credits
          </h1>
          <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
            Turn any property address into a direct conversation. High-accuracy phone numbers, verified emails, 
            and mailing addresses for just <span className="font-bold text-gray-900">$0.10 per lead</span>.
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 items-stretch">
            {skipPackages.map((pkg) => {
              const isPopular = pkg.badge === 'MOST POPULAR';
              return (
                <div
                  key={pkg.packId}
                  className={`relative flex flex-col rounded-2xl bg-white transition-all duration-200 ${
                    isPopular
                      ? 'border-2 border-blue-600 shadow-xl ring-4 ring-blue-600/10 md:-translate-y-2'
                      : 'border border-gray-200 shadow-sm hover:border-gray-300 hover:shadow-md'
                  } p-6 sm:p-8`}
                >
                  {pkg.badge && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase shadow-sm ${
                          isPopular ? 'bg-blue-600 text-white' : 'bg-gray-900 text-white'
                        }`}
                      >
                        {pkg.badge}
                      </span>
                    </div>
                  )}

                  <div className="mb-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-1">{pkg.name}</h2>
                    <p className="text-xs sm:text-sm text-gray-500 min-h-[36px]">{pkg.description}</p>
                  </div>

                  <div className="mb-6 pb-6 border-b border-gray-100">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">
                        {pkg.price}
                      </span>
                      <span className="text-sm font-medium text-gray-500">one-time</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-1.5 border border-gray-100">
                      <span className="font-semibold text-blue-600">{pkg.credits} Credits</span>
                      <span>{pkg.perCredit} / skip trace</span>
                    </div>
                  </div>

                  {/* Features */}
                  <div className="flex-1 space-y-3 mb-8">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Included in this pack:
                    </div>
                    {pkg.features.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-gray-700">
                        <HiCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>

                  <BuyCreditsButton
                    packId={pkg.packId}
                    price={pkg.price}
                    className={`w-full py-3 px-4 rounded-xl font-semibold text-sm sm:text-base transition-all shadow-sm ${
                      isPopular
                        ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                    }`}
                    label={`Get ${pkg.credits} Credits (${pkg.price})`}
                  />
                </div>
              );
            })}
          </div>

          {/* Trust Banner */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs sm:text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <HiShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Secure Stripe 256-bit Checkout</span>
            </div>
            <div className="flex items-center gap-2">
              <HiBolt className="w-4 h-4 text-amber-500" />
              <span>Instant Account Credit</span>
            </div>
            <div className="flex items-center gap-2">
              <HiCheck className="w-4 h-4 text-blue-600" />
              <span>Credits Never Expire</span>
            </div>
          </div>
        </div>

        {/* 5th Grader Explanation: What is Skip Tracing? */}
        <div className="bg-gradient-to-br from-blue-50 via-indigo-50/50 to-white border border-blue-200/70 rounded-3xl p-6 sm:p-10 lg:p-12 shadow-sm">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-800">
              <HiMagnifyingGlass className="w-3.5 h-3.5" />
              <span>Skip Tracing 101</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
              What is Skip Tracing? (Explained for a 5th Grader 🕵️‍♂️)
            </h2>

            <div className="space-y-4 text-gray-700 text-sm sm:text-base leading-relaxed">
              <p className="bg-white/80 p-4 sm:p-5 rounded-2xl border border-blue-100/60 shadow-xs">
                <strong>Imagine this:</strong> You are walking down your street on a sunny afternoon and you see a really cool 
                old house with a big apple tree in the front yard. The grass is tall, the windows are dark, and nobody is home. 
                You want to ask the homeowner if they want to sell the house or let you pick the apples.
              </p>

              <p>
                <strong>The problem?</strong> All you have is the street address on the mailbox! You don’t know who lives there, 
                you don’t know their name, and you don’t have their phone number. If you knock on the door and nobody answers, how do you find them?
              </p>

              <div className="p-5 sm:p-6 bg-white rounded-2xl border-l-4 border-blue-600 shadow-sm space-y-2">
                <h3 className="text-base sm:text-lg font-bold text-gray-900">
                  That’s where Skip Tracing comes to the rescue!
                </h3>
                <p className="text-gray-600 text-sm sm:text-base">
                  Think of skip tracing like having a <strong>super-smart digital detective</strong>. 
                  In just two seconds, our computer detective looks through millions of official public records, county deeds, 
                  and phone directories. It connects the dots to tell you:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm sm:text-base text-gray-700 pt-2 font-medium">
                  <li>Who owns the property</li>
                  <li>Their cell phone and home numbers</li>
                  <li>Their email address</li>
                  <li>Where they currently live</li>
                </ul>
              </div>

              <div className="bg-blue-100/60 p-4 rounded-xl text-xs sm:text-sm text-blue-900 border border-blue-200/50">
                <span className="font-bold">Why is it called &ldquo;Skip Tracing&rdquo;?</span> Decades ago, when someone moved away unexpectedly, 
                people said they <em>&ldquo;skipped town.&rdquo;</em> Detectives had to <em>&ldquo;trace the skip&rdquo;</em> to find where they went. 
                Today, real estate investors use high-speed software to do the same detective work in a couple of clicks!
              </div>
            </div>
          </div>
        </div>

        {/* 1 Credit = 1 Full Property Record */}
        <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-10 shadow-sm text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 mb-4">
            <HiSparkles className="w-6 h-6" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-3">
            How Many Leads Can You Skip Trace per Credit?
          </h2>
          <div className="inline-block bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl text-emerald-900 font-bold text-lg sm:text-xl mb-4">
            1 Credit = 1 Full Property Record (Lead)
          </div>
          <p className="text-gray-600 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            We never charge you separately for phone numbers, emails, or addresses. When you spend <strong>1 credit</strong> on a property address, 
            you unlock <strong>every single contact record</strong> found for that homeowner. If an owner has 3 cell numbers and 2 emails, 
            you get them all for just that 1 credit!
          </p>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 text-center">
              <div className="text-2xl font-black text-gray-900">100 Credits</div>
              <div className="text-xs text-gray-500 mt-1">Enriches 100 complete properties</div>
            </div>
            <div className="p-4 bg-blue-50/70 rounded-2xl border border-blue-100 text-center">
              <div className="text-2xl font-black text-blue-700">250 Credits</div>
              <div className="text-xs text-blue-600 mt-1">Enriches 250 complete properties</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 text-center">
              <div className="text-2xl font-black text-gray-900">500 Credits</div>
              <div className="text-xs text-gray-500 mt-1">Enriches 500 complete properties</div>
            </div>
          </div>
        </div>

        {/* What Information Do We Obtain? */}
        <div>
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-3">
              What Information Do You Obtain?
            </h2>
            <p className="text-sm sm:text-base text-gray-600">
              Each skip trace delivers comprehensive, multi-channel contact data directly to your dashboard.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {dataFields.map((field, idx) => {
              const Icon = field.icon;
              return (
                <div
                  key={idx}
                  className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-7 shadow-xs hover:border-blue-300 transition-colors flex gap-4 items-start"
                >
                  <div className={`p-3 rounded-xl shrink-0 ${field.iconBg}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1">
                      {field.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                      {field.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* How It Works in 3 Steps */}
        <div className="bg-gray-900 text-white rounded-3xl p-6 sm:p-12 shadow-xl">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-800 text-blue-400 mb-3">
              <HiBolt className="w-4 h-4" />
              <span>Fast & Simple</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold">How It Works in 3 Simple Steps</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {steps.map((st, i) => (
              <div key={i} className="relative flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-blue-600 text-white font-extrabold text-lg flex items-center justify-center mb-4 shadow-lg ring-4 ring-blue-500/20">
                  {st.step}
                </div>
                <h3 className="text-base sm:text-lg font-bold mb-2">{st.title}</h3>
                <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">{st.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* FAQs */}
        <div>
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-3">
              Frequently Asked Questions
            </h2>
            <p className="text-sm sm:text-base text-gray-600">
              Got questions about credits or skip tracing? Here are straightforward answers.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {faqs.map((faq, idx) => (
              <div key={idx} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs">
                <h3 className="text-sm sm:text-base font-bold text-gray-900 mb-2 flex items-start gap-2">
                  <span className="text-blue-600 shrink-0 font-extrabold">Q:</span>
                  <span>{faq.q}</span>
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 leading-relaxed pl-5">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
