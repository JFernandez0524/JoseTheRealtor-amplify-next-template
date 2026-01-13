interface StatCardProps {
  value: string;
  label: string;
  color?: string;
}

export function StatCard({ value, label, color = "text-blue-400" }: StatCardProps) {
  return (
    <div className='text-center'>
      <div className={`text-4xl font-bold ${color} mb-2`}>{value}</div>
      <div className='text-gray-300'>{label}</div>
    </div>
  );
}
