import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload as UploadIcon, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import CryptoJS from 'crypto-js';

export default function Upload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const validateFile = (file: File): string | null => {
    if (file.type !== 'application/pdf') {
      return 'Only PDF files are allowed';
    }
    if (file.size > 10 * 1024 * 1024) {
      return 'File size must be less than 10MB';
    }
    return null;
  };

  const calculateSHA256 = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const wordArray = CryptoJS.lib.WordArray.create(e.target?.result as ArrayBuffer);
        const hash = CryptoJS.SHA256(wordArray).toString();
        resolve(hash);
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const error = validateFile(droppedFile);
      if (error) {
        toast({
          title: 'Invalid file',
          description: error,
          variant: 'destructive',
        });
        return;
      }
      setFile(droppedFile);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const error = validateFile(selectedFile);
      if (error) {
        toast({
          title: 'Invalid file',
          description: error,
          variant: 'destructive',
        });
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file || !user) return;

    setUploading(true);

    try {
      // Calculate SHA-256 hash
      const sha256 = await calculateSHA256(file);

      // Check for duplicate
      const { data: existingFiles } = await supabase
        .from('files')
        .select('id')
        .eq('sha256', sha256)
        .eq('user_id', user.id);

      if (existingFiles && existingFiles.length > 0) {
        toast({
          title: 'Duplicate file',
          description: 'This payslip has already been uploaded',
          variant: 'destructive',
        });
        setUploading(false);
        return;
      }

      // Upload to Supabase Storage
      const filePath = `${user.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('payslips')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create file record
      const { data: fileRecord, error: fileError } = await supabase
        .from('files')
        .insert({
          user_id: user.id,
          sha256,
          s3_key_original: filePath,
          file_name: file.name,
          file_size: file.size,
        })
        .select()
        .single();

      if (fileError) throw fileError;

      // TODO: Trigger extraction worker (to be implemented by Codex)
      // For now, create a mock payslip record
      const { error: payslipError } = await supabase
        .from('payslips')
        .insert({
          user_id: user.id,
          file_id: fileRecord.id,
          review_required: true,
          explainer_text: 'Upload successful. Extraction pipeline not yet implemented.',
        });

      if (payslipError) throw payslipError;

      toast({
        title: 'Success',
        description: 'Payslip uploaded successfully',
      });

      navigate('/dashboard');
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Upload Payslip</h1>
            <p className="text-muted-foreground mt-1">
              Upload a PDF payslip to get started with analysis
            </p>
          </div>

          <Card className="shadow-card">
            <CardContent className="p-6">
              <div
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-smooth ${
                  dragActive
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                {!file ? (
                  <div className="space-y-4">
                    <div className="bg-primary/10 rounded-full p-6 inline-block">
                      <UploadIcon className="h-12 w-12 text-primary" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold mb-2">
                        Drop your payslip here
                      </p>
                      <p className="text-sm text-muted-foreground mb-4">
                        or click to browse (PDF only, max 10MB, up to 6 pages)
                      </p>
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={handleChange}
                        className="hidden"
                        id="file-upload"
                      />
                      <Button asChild variant="outline">
                        <label htmlFor="file-upload" className="cursor-pointer">
                          Choose File
                        </label>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-success/10 rounded-full p-6 inline-block">
                      <CheckCircle2 className="h-12 w-12 text-success" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold mb-2">{file.name}</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <div className="flex gap-3 justify-center">
                        <Button
                          onClick={handleUpload}
                          disabled={uploading}
                          size="lg"
                        >
                          {uploading ? 'Uploading...' : 'Upload & Process'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setFile(null)}
                          disabled={uploading}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 space-y-3">
                <div className="flex items-start gap-3 text-sm text-muted-foreground">
                  <FileText className="h-5 w-5 shrink-0 mt-0.5" />
                  <p>We support PDF payslips only. Make sure your document is clear and readable.</p>
                </div>
                <div className="flex items-start gap-3 text-sm text-muted-foreground">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <p>Your data is encrypted and secure. We never share your payslip information.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
