import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { TrendingUp, Mail } from 'lucide-react';
import { formatMoney } from '@/lib/format';

export interface PensionCoachProps {
  open: boolean;
  onClose: () => void;
  gross: number;
  pension_employee: number;
  assumptions?: {
    cagrPct: number;
    salaryGrowthPct: number;
    years: number;
  };
  currency?: string;
  onEmailReminder?: () => Promise<void>;
}

export function PensionCoachModal({
  open,
  onClose,
  gross,
  pension_employee,
  assumptions = { cagrPct: 5, salaryGrowthPct: 2, years: 30 },
  currency = 'GBP',
  onEmailReminder,
}: PensionCoachProps) {
  const [localAssumptions, setLocalAssumptions] = useState(assumptions);

  // Simple projection calculation
  const calculateProjection = () => {
    const monthlyContribution = pension_employee;
    const annualContribution = monthlyContribution * 12;
    const years = localAssumptions.years;
    const rate = localAssumptions.cagrPct / 100;

    // Future value of annuity formula
    let futureValue = 0;
    for (let i = 0; i < years; i++) {
      futureValue = (futureValue + annualContribution) * (1 + rate);
    }

    return futureValue;
  };

  const projectedValue = calculateProjection();
  const currentContributionRate = gross > 0 ? (pension_employee / gross) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Pension Coach
          </DialogTitle>
          <DialogDescription>
            Project your pension growth and optimize your contributions
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Current Status */}
          <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10">
            <h3 className="font-semibold mb-4">Current Pension Status</h3>
            <div className="grid gap-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Monthly Contribution</span>
                <span className="font-semibold text-lg">
                  {formatMoney(pension_employee, currency)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Contribution Rate</span>
                <span className="font-semibold text-lg">
                  {currentContributionRate.toFixed(1)}%
                </span>
              </div>
            </div>
          </Card>

          {/* Projection Inputs */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Projection Assumptions</h3>
            <div className="space-y-6">
              {/* Years to Retirement */}
              <div className="space-y-2">
                <Label>Years to Retirement: {localAssumptions.years}</Label>
                <Slider
                  value={[localAssumptions.years]}
                  onValueChange={([value]) =>
                    setLocalAssumptions({ ...localAssumptions, years: value })
                  }
                  min={1}
                  max={45}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* Expected Return */}
              <div className="space-y-2">
                <Label htmlFor="cagr">
                  Expected Annual Return: {localAssumptions.cagrPct}%
                </Label>
                <Slider
                  value={[localAssumptions.cagrPct]}
                  onValueChange={([value]) =>
                    setLocalAssumptions({ ...localAssumptions, cagrPct: value })
                  }
                  min={0}
                  max={15}
                  step={0.5}
                  className="w-full"
                />
              </div>

              {/* Salary Growth */}
              <div className="space-y-2">
                <Label htmlFor="salary-growth">
                  Expected Salary Growth: {localAssumptions.salaryGrowthPct}%
                </Label>
                <Slider
                  value={[localAssumptions.salaryGrowthPct]}
                  onValueChange={([value]) =>
                    setLocalAssumptions({ ...localAssumptions, salaryGrowthPct: value })
                  }
                  min={0}
                  max={10}
                  step={0.5}
                  className="w-full"
                />
              </div>
            </div>
          </Card>

          {/* Projection Results */}
          <Card className="p-6 bg-gradient-to-br from-green-500/10 to-green-600/10 border-green-200">
            <h3 className="font-semibold mb-2">Projected Pension Value</h3>
            <p className="text-3xl font-bold text-green-700">
              {formatMoney(projectedValue, currency)}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              In {localAssumptions.years} years, based on current contributions
            </p>
          </Card>

          {/* Recommendations */}
          <Card className="p-6">
            <h3 className="font-semibold mb-3">Recommendations</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>
                  Consider increasing contributions to {(currentContributionRate + 2).toFixed(1)}%
                  to maximize tax relief
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Check if your employer offers matching contributions</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Review your pension fund annually to ensure it aligns with your goals</span>
              </li>
            </ul>
          </Card>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              variant="outline"
              disabled
              className="flex-1"
              title="Email reminders coming soon"
            >
              <Mail className="mr-2 h-4 w-4" />
              Set Reminder
            </Button>
            <Button onClick={onClose} className="flex-1">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
