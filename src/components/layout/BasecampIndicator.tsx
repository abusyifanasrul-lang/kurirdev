import { MapPin } from 'lucide-react';
import { useActiveBasecamp } from '@/hooks/useActiveBasecamp';

export function BasecampIndicator() {
  const { activeBasecamp } = useActiveBasecamp();

  if (!activeBasecamp) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-brand-cyan/10 border border-brand-cyan/20 rounded-lg">
      <MapPin className="h-4 w-4 text-brand-cyan flex-shrink-0" />
      <span className="text-sm font-medium text-white truncate">
        {activeBasecamp.name}
      </span>
    </div>
  );
}
