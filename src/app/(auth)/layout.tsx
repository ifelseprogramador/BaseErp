export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-muted/30 flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
