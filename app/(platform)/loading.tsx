import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function PlatformLoading() {
  return (
    <div aria-label="页面加载中" className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index}>
            <CardHeader>
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-28" />
            </CardHeader>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="space-y-3 py-4">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-36 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

