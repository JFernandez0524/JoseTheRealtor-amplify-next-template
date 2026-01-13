interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
  features?: string[];
  gradient?: string;
}

export function FeatureCard({ icon, title, description, features, gradient = "from-blue-500 to-blue-600" }: FeatureCardProps) {
  return (
    <div className='bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow border border-gray-100'>
      <div className={`w-12 h-12 bg-gradient-to-br ${gradient} rounded-lg flex items-center justify-center mb-6`}>
        <span className='text-2xl text-white'>{icon}</span>
      </div>
      <h3 className='text-xl font-semibold text-gray-900 mb-3'>{title}</h3>
      <p className='text-gray-600 mb-4'>{description}</p>
      {features && (
        <ul className='space-y-2 text-sm text-gray-600'>
          {features.map((feature, index) => (
            <li key={index} className='flex items-center'>
              <span className='text-green-500 mr-2'>✓</span>
              {feature}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
