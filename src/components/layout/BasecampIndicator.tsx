import { MapPin } from 'lucide-react';
import { useActiveBasecamp } from '@/hooks/useActiveBasecamp';

export function BasecampIndicator() {
  const { activeBasecamp } = useActiveBasecamp();

  if (!activeBasecamp) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg">
      <MapPin className="h-4 w-4 text-purple-600 flex-shrink-0" />
      <span className="text-sm font-medium text-purple-700 truncate">
        {activeBasecamp.name}
      </span>
    </div>
  );
}
