export default function DataAttribution() {
  return (
    <div className='mt-4 text-xs text-gray-500 text-center space-y-1'>
      <p>
        Property data and Zestimates® powered by{' '}
        <a
          href='https://www.zillow.com/zestimate/'
          target='_blank'
          rel='noopener noreferrer'
          className='text-blue-600 underline'
        >
          Zillow
        </a>
        .
      </p>
      <p>Mapping and address suggestions powered by Google.</p>
    </div>
  );
}
