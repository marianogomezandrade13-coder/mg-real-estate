interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-5 sm:mb-6">
      <div className="min-w-0">
        <h1 className="text-[22px] sm:text-[26px] font-bold text-[#1F2421] font-[family-name:var(--font-space-grotesk)]">
          {title}
        </h1>
        {subtitle && <p className="text-[13px] text-[#676B63] mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0 self-start">{action}</div>}
    </div>
  );
}
