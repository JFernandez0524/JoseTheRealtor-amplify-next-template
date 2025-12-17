import React, { useState } from 'react';

interface ContactActionItemProps {
  // Fix: Allow null/undefined to match DynamoDB schema types
  value: string | null | undefined;
  type: 'phone' | 'email';
}

const formatPhoneNumber = (phoneString: string) => {
  const cleaned = ('' + phoneString).replace(/\D/g, '');
  const match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    const intlCode = match[1] ? '+1 ' : '';
    return `${intlCode}(${match[2]}) ${match[3]} - ${match[4]}`;
  }
  return phoneString;
};

export const ContactActionItem: React.FC<ContactActionItemProps> = ({
  value,
  type,
}) => {
  const [copied, setCopied] = useState(false);

  // Safety check: if DynamoDB returns a null entry, don't render anything
  if (!value) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className='flex items-center justify-between p-3 bg-gray-50 hover:bg-white rounded-md border border-gray-100 group transition-all shadow-sm'>
      <div className='flex flex-col'>
        <span
          className={`${type === 'phone' ? 'font-mono font-bold' : 'font-medium'} text-gray-700`}
        >
          {type === 'phone' ? formatPhoneNumber(value) : value}
        </span>
      </div>

      <div className='flex gap-2'>
        {/* Copy Button */}
        <button
          onClick={handleCopy}
          className={`p-2 rounded border transition-all ${copied ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-gray-200 text-gray-400 hover:text-indigo-600'}`}
          title='Copy to clipboard'
        >
          {copied ? '✓' : '📋'}
        </button>

        {type === 'phone' ? (
          <>
            <a
              href={`tel:${value}`}
              className='p-2 bg-white border border-green-200 rounded text-green-600 hover:bg-green-600 hover:text-white transition-all'
            >
              📞
            </a>
            <a
              href={`sms:${value}`}
              className='p-2 bg-white border border-blue-200 rounded text-blue-600 hover:bg-blue-600 hover:text-white transition-all'
            >
              💬
            </a>
          </>
        ) : (
          <a
            href={`mailto:${value}`}
            className='p-2 bg-white border border-blue-200 rounded text-blue-600 hover:bg-blue-600 hover:text-white transition-all'
          >
            ✉️
          </a>
        )}
      </div>
    </div>
  );
};
