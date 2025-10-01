import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Settings as SettingsType, Job } from '@/types/database';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Trash2, Download } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

export default function Settings() {
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Poll for active jobs
  const { data: activeJobs, refetch: refetchJobs } = useQuery({
    queryKey: ['active-jobs'],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('user_id', user.id)
        .in('kind', ['delete_all', 'export_all'])
        .in('status', ['queued', 'running'])
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Job[];
    },
    refetchInterval: 3000, // Poll every 3 seconds
    enabled: !!user,
  });

  const deleteAllJob = activeJobs?.find(j => j.kind === 'delete_all');
  const exportAllJob = activeJobs?.find(j => j.kind === 'export_all');

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setSettings(data as SettingsType);
    } catch (error: any) {
      toast({
        title: 'Error loading settings',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !settings) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('settings')
        .update({
          retention_days: settings.retention_days,
          region: settings.region,
          locale: settings.locale,
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: 'Settings saved',
        description: 'Your preferences have been updated',
      });
    } catch (error: any) {
      toast({
        title: 'Error saving settings',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!user) return;

    const confirmed = confirm(
      'Are you sure you want to delete all your data? This action cannot be undone.'
    );
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('jobs')
        .insert({
          user_id: user.id,
          kind: 'delete_all',
          status: 'queued',
          meta: {},
        });

      if (error) throw error;

      toast({
        title: 'Deletion queued',
        description: 'Your data deletion request has been queued',
      });

      refetchJobs();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleExportAll = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('jobs')
        .insert({
          user_id: user.id,
          kind: 'export_all',
          status: 'queued',
          meta: {},
        });

      if (error) throw error;

      toast({
        title: 'Export queued',
        description: 'Your data export request has been queued',
      });

      refetchJobs();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto space-y-6">
            <Skeleton className="h-12 w-64" />
            <Skeleton className="h-96" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground mt-1">
              Manage your account preferences and data retention
            </p>
          </div>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Data Retention</CardTitle>
              <CardDescription>
                Choose how long to keep your payslip data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Retention Period</Label>
                <Select
                  value={settings?.retention_days.toString()}
                  onValueChange={(value) =>
                    setSettings(prev => prev ? { ...prev, retention_days: parseInt(value) as 30 | 90 } : null)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Files older than this will be automatically deleted
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Region & Locale</CardTitle>
              <CardDescription>
                Set your tax region and language preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Tax Region</Label>
                <Select
                  value={settings?.region}
                  onValueChange={(value) =>
                    setSettings(prev => prev ? { ...prev, region: value as 'UK' | 'IE' } : null)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UK">United Kingdom</SelectItem>
                    <SelectItem value="IE">Ireland</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Locale</Label>
                <Select
                  value={settings?.locale}
                  onValueChange={(value) =>
                    setSettings(prev => prev ? { ...prev, locale: value } : null)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en-GB">English (UK)</SelectItem>
                    <SelectItem value="en-IE">English (Ireland)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Data Management</CardTitle>
              <CardDescription>
                Export or delete your data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleExportAll}
                  disabled={!!exportAllJob}
                  className="flex-1"
                >
                  {exportAllJob ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Export All Data
                    </>
                  )}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteAll}
                  disabled={!!deleteAllJob}
                  className="flex-1"
                >
                  {deleteAllJob ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete All Data
                    </>
                  )}
                </Button>
              </div>

              {/* Job Status Indicators */}
              {deleteAllJob && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-red-600" />
                    <span className="text-sm font-medium text-red-900">
                      Deletion in progress: {deleteAllJob.status}
                    </span>
                  </div>
                </div>
              )}

              {exportAllJob && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">
                      Export in progress: {exportAllJob.status}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={loadSettings} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>

          <Card className="shadow-card bg-muted/50">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">
                <strong>Privacy Notice:</strong> Payslip Companion is an educational tool. We do not provide regulated financial advice. Always verify tax calculations with HMRC or Revenue.ie.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
