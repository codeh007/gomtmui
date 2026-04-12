import { cn } from "mtxuilib/lib/utils";

interface DashHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function DashHeader({ children, className, ...props }: DashHeaderProps) {
  return (
    <div className={cn("flex flex-row items-center justify-between pb-4", className)} {...props}>
      {children}
    </div>
  );
}
