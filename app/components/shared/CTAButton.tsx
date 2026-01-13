interface CTAButtonProps {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  className?: string;
}

export function CTAButton({ href, children, variant = 'primary', className = '' }: CTAButtonProps) {
  const baseClasses = 'px-8 py-4 rounded-lg font-semibold transition-colors';
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'border border-slate-300 text-slate-700 hover:bg-slate-50'
  };

  return (
    <a 
      href={href} 
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
    >
      {children}
    </a>
  );
}
