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
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, FileText, ExternalLink } from 'lucide-react';
import { formatMoney } from '@/lib/format';

export interface DossierResponse {
  totals: {
    gross: number;
    net: number;
    tax_income: number;
    ni_prsi: number;
    pension_employee: number;
    pension_employer: number;
  };
  months: Array<{
    month: string;
    gross: number;
    net: number;
    tax_income: number;
    ni_prsi: number;
    pension_employee: number;
  }>;
  checklist: Array<{
    title: string;
    note: string;
    link: string;
  }>;
}

interface DossierModalProps {
  open: boolean;
  onClose: () => void;
  data: DossierResponse | null;
  currency?: string;
  loading?: boolean;
}

export function DossierModal({
  open,
  onClose,
  data,
  currency = 'GBP',
  loading = false,
}: DossierModalProps) {
  const [activeTab, setActiveTab] = useState('summary');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Annual Dossier
          </DialogTitle>
          <DialogDescription>
            Your complete year-to-date financial summary and checklist
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="py-12 text-center text-muted-foreground">
            Loading dossier data...
          </div>
        )}

        {!loading && !data && (
          <div className="py-12 text-center text-muted-foreground">
            No dossier data available
          </div>
        )}

        {!loading && data && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="monthly">Monthly Breakdown</TabsTrigger>
              <TabsTrigger value="checklist">Checklist</TabsTrigger>
            </TabsList>

            {/* Summary Tab */}
            <TabsContent value="summary" className="space-y-4 mt-4">
              <Card className="p-6">
                <h3 className="font-semibold mb-4">Year-to-Date Totals</h3>
                <div className="grid gap-3">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Gross Pay</span>
                    <span className="font-semibold">
                      {formatMoney(data.totals.gross, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Net Pay</span>
                    <span className="font-semibold">
                      {formatMoney(data.totals.net, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Income Tax</span>
                    <span className="font-semibold">
                      {formatMoney(data.totals.tax_income, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">NI / PRSI</span>
                    <span className="font-semibold">
                      {formatMoney(data.totals.ni_prsi, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Employee Pension</span>
                    <span className="font-semibold">
                      {formatMoney(data.totals.pension_employee, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Employer Pension</span>
                    <span className="font-semibold">
                      {formatMoney(data.totals.pension_employer, currency)}
                    </span>
                  </div>
                </div>
              </Card>
            </TabsContent>

            {/* Monthly Breakdown Tab */}
            <TabsContent value="monthly" className="space-y-4 mt-4">
              <div className="space-y-3">
                {data.months.map((month, idx) => (
                  <Card key={idx} className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold">{month.month}</h4>
                      <Badge variant="outline">{formatMoney(month.net, currency)}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Gross:</span>
                        <span>{formatMoney(month.gross, currency)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tax:</span>
                        <span>{formatMoney(month.tax_income, currency)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">NI/PRSI:</span>
                        <span>{formatMoney(month.ni_prsi, currency)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Pension:</span>
                        <span>{formatMoney(month.pension_employee, currency)}</span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Checklist Tab */}
            <TabsContent value="checklist" className="space-y-4 mt-4">
              <div className="space-y-3">
                {data.checklist.map((item, idx) => (
                  <Card key={idx} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h4 className="font-semibold mb-1">{item.title}</h4>
                        <p className="text-sm text-muted-foreground">{item.note}</p>
                      </div>
                      {item.link && (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Link
                          </a>
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* Export Buttons (Disabled for now) */}
        <div className="flex gap-3 pt-4 border-t">
          <Button variant="outline" disabled className="flex-1">
            <Download className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
          <Button variant="outline" disabled className="flex-1">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
