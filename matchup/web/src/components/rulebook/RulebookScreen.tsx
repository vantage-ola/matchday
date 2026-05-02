import { Button } from '@/components/ui/button';
import { RulebookContent } from './RulebookContent';

interface RulebookScreenProps {
  onBack: () => void;
}

export function RulebookScreen({ onBack }: RulebookScreenProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex items-center gap-3 border-b border-border p-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-9 px-2">
          ← BACK
        </Button>
        <h1 className="text-lg font-bold tracking-tight">HOW TO PLAY</h1>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-md">
          <RulebookContent />
        </div>
      </div>
    </div>
  );
}
