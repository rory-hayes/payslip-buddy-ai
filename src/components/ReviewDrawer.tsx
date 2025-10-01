import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { formatMoney } from '@/lib/format';

export interface Highlight {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

export interface ReviewDrawerProps {
  open: boolean;
  imageUrl: string;
  highlights: Highlight[];
  fields: {
    gross: number | null;
    net: number | null;
    tax_income: number | null;
    ni_prsi: number | null;
    pension_employee: number | null;
  };
  confidence?: number;
  reviewRequired: boolean;
  currency?: string;
  onConfirm: (finalFields: ReviewDrawerProps['fields']) => Promise<void>;
  onCancel: () => void;
}

export function ReviewDrawer({
  open,
  imageUrl,
  highlights,
  fields: initialFields,
  confidence = 1,
  reviewRequired,
  currency = 'GBP',
  onConfirm,
  onCancel,
}: ReviewDrawerProps) {
  const [fields, setFields] = useState(initialFields);
  const [confirming, setConfirming] = useState(false);

  const needsReview = reviewRequired || confidence < 0.9;

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm(fields);
    } finally {
      setConfirming(false);
    }
  };

  const handleFieldChange = (field: keyof typeof fields, value: string) => {
    const numValue = value === '' ? null : parseFloat(value);
    setFields((prev) => ({ ...prev, [field]: numValue }));
  };

  const getConfidenceColor = () => {
    if (confidence >= 0.9) return 'text-green-600';
    if (confidence >= 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Sheet open={open} onOpenChange={needsReview ? undefined : onCancel}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Review Extracted Data</SheetTitle>
          <SheetDescription>
            {needsReview ? (
              <span className="flex items-center gap-2 text-yellow-600">
                <AlertCircle className="h-4 w-4" />
                Review required before continuing
              </span>
            ) : (
              <span className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                Data extracted successfully
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Confidence Score */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="text-sm font-medium">Confidence Score</span>
            <Badge variant="outline" className={getConfidenceColor()}>
              {(confidence * 100).toFixed(0)}%
            </Badge>
          </div>

          {/* Preview Image with Highlights */}
          <div className="relative border rounded-lg overflow-hidden bg-muted/50">
            <img
              src={imageUrl}
              alt="Payslip preview"
              className="w-full h-auto"
              style={{ maxHeight: '400px', objectFit: 'contain' }}
            />
            {highlights.map((highlight, idx) => (
              <div
                key={idx}
                className="absolute border-2 border-primary bg-primary/10"
                style={{
                  left: `${highlight.x}%`,
                  top: `${highlight.y}%`,
                  width: `${highlight.w}%`,
                  height: `${highlight.h}%`,
                }}
                aria-label={`Highlight ${highlight.label}`}
                title={highlight.label}
              />
            ))}
          </div>

          {/* Editable Fields */}
          <div className="space-y-4">
            <h3 className="font-semibold">Extracted Values</h3>

            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="gross">Gross Pay</Label>
                <Input
                  id="gross"
                  type="number"
                  step="0.01"
                  value={fields.gross ?? ''}
                  onChange={(e) => handleFieldChange('gross', e.target.value)}
                  placeholder="0.00"
                />
                {fields.gross !== null && (
                  <p className="text-sm text-muted-foreground">
                    {formatMoney(fields.gross, currency)}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="net">Net Pay</Label>
                <Input
                  id="net"
                  type="number"
                  step="0.01"
                  value={fields.net ?? ''}
                  onChange={(e) => handleFieldChange('net', e.target.value)}
                  placeholder="0.00"
                />
                {fields.net !== null && (
                  <p className="text-sm text-muted-foreground">
                    {formatMoney(fields.net, currency)}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="tax_income">Income Tax</Label>
                <Input
                  id="tax_income"
                  type="number"
                  step="0.01"
                  value={fields.tax_income ?? ''}
                  onChange={(e) => handleFieldChange('tax_income', e.target.value)}
                  placeholder="0.00"
                />
                {fields.tax_income !== null && (
                  <p className="text-sm text-muted-foreground">
                    {formatMoney(fields.tax_income, currency)}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="ni_prsi">National Insurance / PRSI</Label>
                <Input
                  id="ni_prsi"
                  type="number"
                  step="0.01"
                  value={fields.ni_prsi ?? ''}
                  onChange={(e) => handleFieldChange('ni_prsi', e.target.value)}
                  placeholder="0.00"
                />
                {fields.ni_prsi !== null && (
                  <p className="text-sm text-muted-foreground">
                    {formatMoney(fields.ni_prsi, currency)}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="pension_employee">Employee Pension</Label>
                <Input
                  id="pension_employee"
                  type="number"
                  step="0.01"
                  value={fields.pension_employee ?? ''}
                  onChange={(e) => handleFieldChange('pension_employee', e.target.value)}
                  placeholder="0.00"
                />
                {fields.pension_employee !== null && (
                  <p className="text-sm text-muted-foreground">
                    {formatMoney(fields.pension_employee, currency)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            {!needsReview && (
              <Button variant="outline" onClick={onCancel} className="flex-1">
                Cancel
              </Button>
            )}
            <Button
              onClick={handleConfirm}
              disabled={confirming}
              className="flex-1"
            >
              {confirming ? 'Saving...' : needsReview ? 'Confirm & Continue' : 'Looks Correct'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
