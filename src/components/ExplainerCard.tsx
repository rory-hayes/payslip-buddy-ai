import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Info } from 'lucide-react';

interface ExplainerCardProps {
  text: string;
}

export function ExplainerCard({ text }: ExplainerCardProps) {
  return (
    <Card className="shadow-card bg-accent/5 border-accent/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-accent" />
          <CardTitle className="text-lg">Understanding Your Payslip</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-base leading-relaxed">
          {text || 'Your payslip shows your gross pay, which is your total earnings before any deductions. From this, your employer deducts income tax, National Insurance (or PRSI in Ireland), and any pension contributions. What remains is your net pay – the amount that goes into your bank account.'}
        </CardDescription>
      </CardContent>
    </Card>
  );
}
