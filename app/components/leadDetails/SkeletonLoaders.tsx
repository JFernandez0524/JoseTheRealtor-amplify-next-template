interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
  );
}

export function MapSkeleton() {
  return (
    <div className="h-[250px] md:h-[350px] bg-gray-100 relative overflow-hidden">
      <Skeleton className="absolute inset-0" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-400">
          <Skeleton className="w-5 h-5 rounded-full" />
          <Skeleton className="w-32 h-4" />
        </div>
      </div>
    </div>
  );
}

export function PropertyInfoSkeleton() {
  return (
    <div className="p-10 space-y-4">
      <Skeleton className="w-20 h-6" />
      <Skeleton className="w-full h-12" />
      <div className="flex justify-between items-end">
        <div className="space-y-2">
          <Skeleton className="w-32 h-4" />
          <Skeleton className="w-48 h-8" />
        </div>
        <div className="bg-gray-50 p-6 rounded-2xl min-w-[240px]">
          <Skeleton className="w-24 h-3 mb-2" />
          <Skeleton className="w-32 h-10" />
        </div>
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6">
      <div className="flex justify-between items-center mb-6">
        <Skeleton className="w-32 h-6" />
        <Skeleton className="w-16 h-8 rounded-full" />
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Skeleton className="w-20 h-4 mb-2" />
            <Skeleton className="w-full h-6" />
          </div>
          <div>
            <Skeleton className="w-20 h-4 mb-2" />
            <Skeleton className="w-full h-6" />
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="w-full h-12" />
          <Skeleton className="w-full h-12" />
          <Skeleton className="w-3/4 h-12" />
        </div>
      </div>
    </div>
  );
}

export function SidebarSkeleton() {
  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-[2.5rem] p-10">
        <Skeleton className="w-24 h-4 mb-10 bg-slate-700" />
        <div className="space-y-5">
          <Skeleton className="w-full h-12 bg-slate-700" />
          <Skeleton className="w-full h-12 bg-slate-700" />
        </div>
      </div>
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}
