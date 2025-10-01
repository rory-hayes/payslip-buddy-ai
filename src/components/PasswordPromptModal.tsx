import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';

interface PasswordPromptModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (password: string) => void;
}

export function PasswordPromptModal({
  open,
  onClose,
  onSubmit,
}: PasswordPromptModalProps) {
  const [password, setPassword] = useState('');

  const handleSubmit = () => {
    if (password.trim()) {
      onSubmit(password);
      setPassword('');
      onClose();
    }
  };

  const handleCancel = () => {
    setPassword('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            PDF Password Required
          </DialogTitle>
          <DialogDescription>
            This PDF is password-protected. Please enter the password to continue.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="pdf-password">Password</Label>
            <Input
              id="pdf-password"
              type="password"
              placeholder="Enter PDF password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!password.trim()}>
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
