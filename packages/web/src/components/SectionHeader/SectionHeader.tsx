import type { LucideIcon } from 'lucide-react';

interface SectionHeaderProps {
  icon: LucideIcon;
  label: string;
  as?: 'div' | 'span' | 'label';
  className?: string;
}

export function SectionHeader({ icon: Icon, label, as: Tag = 'div', className }: SectionHeaderProps) {
  const classes = ['control-label', 'section-label', className].filter(Boolean).join(' ');

  return (
    <Tag className={classes}>
      <Icon size={14} />
      <span>{label}</span>
    </Tag>
  );
}
