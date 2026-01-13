interface SectionProps {
  children: React.ReactNode;
  className?: string;
  background?: 'light' | 'dark' | 'gradient';
}

export function Section({ children, className = '', background = 'light' }: SectionProps) {
  const backgroundClasses = {
    light: 'bg-white',
    dark: 'bg-gray-900 text-white',
    gradient: 'bg-gradient-to-br from-slate-50 via-white to-blue-50'
  };

  return (
    <section className={`py-16 px-4 sm:px-6 lg:px-8 ${backgroundClasses[background]} ${className}`}>
      <div className='max-w-7xl mx-auto'>
        {children}
      </div>
    </section>
  );
}
