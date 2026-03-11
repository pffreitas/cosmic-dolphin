import { Skeleton } from "@/components/ui/skeleton";

export function BookmarkDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      {/* Breadcrumb skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-3" />
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Title skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-7 w-1/2" />
      </div>

      {/* Metadata row skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-24" />
      </div>

      {/* OpenGraph card skeleton */}
      <div className="flex flex-col md:flex-row gap-0 rounded-xl border overflow-hidden">
        <div className="flex-1 p-4 space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <Skeleton className="w-full h-48 md:w-44 md:h-auto rounded-none" />
      </div>

      {/* Tags skeleton */}
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-14 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>

      {/* Summary skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>

      {/* Actions skeleton */}
      <div className="flex items-center gap-2 pt-2">
        <Skeleton className="h-9 w-9 rounded-md" />
        <Skeleton className="h-9 w-9 rounded-md" />
        <Skeleton className="h-9 w-9 rounded-md" />
      </div>
    </div>
  );
}
