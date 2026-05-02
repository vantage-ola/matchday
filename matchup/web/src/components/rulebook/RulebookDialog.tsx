import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { RulebookContent } from './RulebookContent';

interface RulebookDialogProps {
  trigger: React.ReactNode;
}

export function RulebookDialog({ trigger }: RulebookDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>How to play</DialogTitle>
        </DialogHeader>
        <RulebookContent />
      </DialogContent>
    </Dialog>
  );
}
