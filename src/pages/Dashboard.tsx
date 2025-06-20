import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navigation from '../components/Navigation';
import FileUpload from '../components/FileUpload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Download, FileText, Settings } from 'lucide-react';

interface Job {
  id: string;
  filename: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  timestamp: Date;
  questionCount?: number;
}

const Dashboard: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [questionLanguage, setQuestionLanguage] = useState('');
  const [explanationLanguage, setExplanationLanguage] = useState('');
  const [numberOfQuestions, setNumberOfQuestions] = useState('1000');
  const [outputFormat, setOutputFormat] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const navigate = useNavigate();

  // Mock previous jobs data
  // const [previousJobs] = useState<Job[]>([
  //   {
  //     id: '1',
  //     filename: 'sample-document.pdf',
  //     status: 'completed',
  //     timestamp: new Date('2024-06-10T10:30:00'),
  //     questionCount: 850
  //   },
  //   {
  //     id: '2',
  //     filename: 'training-manual.docx',
  //     status: 'in-progress',
  //     timestamp: new Date('2024-06-11T14:15:00')
  //   },
  //   {
  //     id: '3',
  //     filename: 'course-content.pdf',
  //     status: 'pending',
  //     timestamp: new Date('2024-06-12T09:00:00')
  //   }
  // ]);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
  };

  const handleGenerate = async () => {
    if (!selectedFile || !questionLanguage || !explanationLanguage || !outputFormat) {
      return;
    }

    setIsGenerating(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('question_language', questionLanguage);
      formData.append('explanation_language', explanationLanguage);
      formData.append('number_of_questions', numberOfQuestions);
      formData.append('output_format', outputFormat);

      const response = await fetch(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const data = await response.json();

      navigate('/processing', {
        state: {
          filename: selectedFile.name,
          questionLanguage,
          explanationLanguage,
          numberOfQuestions,
          outputFormat,
          jobId: data.job_id
        }
      });
    } catch (error) {
      console.error(error);
      alert('Failed to start generation. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const getStatusBadge = (status: Job['status']) => {
    const variants = {
      'pending': 'secondary',
      'in-progress': 'default',
      'completed': 'default',
      'failed': 'destructive'
    } as const;

    const colors = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'in-progress': 'bg-blue-100 text-blue-800',
      'completed': 'bg-green-100 text-green-800',
      'failed': 'bg-red-100 text-red-800'
    };

    return (
      <Badge className={colors[status]}>
        {status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
      </Badge>
    );
  };

  const isFormValid = selectedFile && questionLanguage && explanationLanguage && outputFormat;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2">Generate questions from your documents</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload Section */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-5 w-5" />
                  <span>Upload Document</span>
                </CardTitle>
                <CardDescription>
                  Upload a PDF or DOCX file to generate questions from
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FileUpload
                  onFileSelect={handleFileSelect}
                  selectedFile={selectedFile}
                  onRemoveFile={handleRemoveFile}
                />
              </CardContent>
            </Card>

            {/* Settings Panel */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Settings className="h-5 w-5" />
                  <span>Generation Settings</span>
                </CardTitle>
                <CardDescription>
                  Customize how questions are generated
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="question-language">Question Language</Label>
                    <Select value={questionLanguage} onValueChange={setQuestionLanguage}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en-uk">English (UK)</SelectItem>
                        <SelectItem value="en-us">English (US)</SelectItem>
                        <SelectItem value="ar">Arabic</SelectItem>
                        <SelectItem value="ru">Russian</SelectItem>
                        <SelectItem value="ja">Japanese</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                        <SelectItem value="de">German</SelectItem>
                        <SelectItem value="zh">Chinese</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="explanation-language">Explanation Language</Label>
                    <Select value={explanationLanguage} onValueChange={setExplanationLanguage}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en-uk">English (UK)</SelectItem>
                        <SelectItem value="en-us">English (US)</SelectItem>
                        <SelectItem value="ar">Arabic</SelectItem>
                        <SelectItem value="ru">Russian</SelectItem>
                        <SelectItem value="ja">Japanese</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                        <SelectItem value="de">German</SelectItem>
                        <SelectItem value="zh">Chinese</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="number-of-questions">Number of Questions</Label>
                    <Input
                      id="number-of-questions"
                      type="number"
                      value={numberOfQuestions}
                      onChange={(e) => setNumberOfQuestions(e.target.value)}
                      placeholder="1000"
                      min="1"
                      max="10000"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="output-format">Output Format</Label>
                    <Select value={outputFormat} onValueChange={setOutputFormat}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="json">JSON</SelectItem>
                        <SelectItem value="excel">Excel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={!isFormValid || isGenerating}
                  className="w-full md:w-auto"
                  size="lg"
                >
                  {isGenerating ? 'Starting Generation...' : 'Generate Questions'}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Previous Jobs */}
          {/* <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5" />
                  <span>Previous Jobs</span>
                </CardTitle>
                <CardDescription>
                  Your recent question generation jobs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {previousJobs.map((job) => (
                    <div
                      key={job.id}
                      className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <p className="font-medium text-sm text-gray-900 truncate">
                          {job.filename}
                        </p>
                        {getStatusBadge(job.status)}
                      </div>
                      
                      <p className="text-xs text-gray-500 mb-2">
                        {job.timestamp.toLocaleDateString()} at{' '}
                        {job.timestamp.toLocaleTimeString()}
                      </p>
                      
                      {job.questionCount && (
                        <p className="text-xs text-gray-600 mb-2">
                          {job.questionCount} questions generated
                        </p>
                      )}
                      
                      {job.status === 'completed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => navigate('/results', { state: { jobId: job.id } })}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div> */}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
