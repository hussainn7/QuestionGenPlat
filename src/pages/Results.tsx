import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Navigation from '../components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, ArrowLeft, Eye } from 'lucide-react';

interface ResultsState {
  filename: string;
  questionLanguage: string;
  explanationLanguage: string;
  numberOfQuestions: string;
  outputFormat: string;
  questionsGenerated: number;
  topicsDetected: number;
  questionsPreview: any[];
  jobId: string;
}

interface Question {
  id: number;
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correct_answer: string; // Changed to string (A/B/C/D)
  explanation: string;
  topic: string;
}

const Results: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as ResultsState;
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const jobId = (location.state as ResultsState)?.jobId;
        if (!jobId) {
          console.error("Job ID not found");
          return;
        }

        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}/jobs/${jobId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch job status');
        }
        const data = await response.json();
        
        // Get all questions, not just the preview
        const allQuestions = data.questions || [];
        setQuestions(allQuestions);
      } catch (error) {
        console.error("Error fetching questions:", error);
        alert("Failed to load questions. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
  }, [location, navigate]);

  const handleDownload = (format: 'json' | 'excel') => {
    const jobId = (location.state as any)?.jobId;
    if (!jobId) {
      console.error("Job ID not found");
      return;
    }

    // Use the questions we already have
    const allQuestions = questions;
    const filename = `questions_${state?.filename?.replace(/\.[^/.]+$/, "") || 'generated'}.${format === 'json' ? 'json' : 'xlsx'}`;
    console.log(`Downloading ${filename} with ${allQuestions.length} questions`);
    
    // Format for Excel
    const excelData = format === 'excel' ? allQuestions.map(q => ({
      ...q,
      correct_answer: q.correct_answer, // No need to convert to A-D
      options: Object.values(q.options).join(', ') // Join options for Excel
    })) : allQuestions;

    const blob = new Blob([JSON.stringify(excelData, null, 2)], { 
      type: format === 'json' ? 'application/json' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!state) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-4xl mx-auto py-12 px-4 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">No Results Found</h1>
          <p className="text-gray-600 mb-6">No generation results available.</p>
          <Button onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Generation Complete!</h1>
              <p className="text-gray-600 mt-2">
                Successfully generated questions from {state.filename}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate('/dashboard')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Summary Cards */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Questions Generated</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {(state?.questionsGenerated ?? questions.length).toLocaleString()}
              </div>
              <p className="text-sm text-gray-600 mt-1">
                out of {parseInt(state.numberOfQuestions).toLocaleString()} requested
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Topics Detected</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {state.topicsDetected}
              </div>
              <p className="text-sm text-gray-600 mt-1">
                unique topics identified
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Languages</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <p className="text-sm font-medium text-gray-700">Questions</p>
                  <p className="text-sm text-gray-600">{state.questionLanguage}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Explanations</p>
                  <p className="text-sm text-gray-600">{state.explanationLanguage}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Download Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Download className="h-5 w-5" />
              <span>Download Results</span>
            </CardTitle>
            <CardDescription>
              Download your generated questions in your preferred format
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                onClick={() => handleDownload('json')}
                className="flex-1"
                size="lg"
              >
                <FileText className="h-4 w-4 mr-2" />
                Download JSON
              </Button>
              <Button
                onClick={() => handleDownload('excel')}
                variant="outline"
                className="flex-1"
                size="lg"
              >
                <FileText className="h-4 w-4 mr-2" />
                Download Excel
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preview Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Eye className="h-5 w-5" />
              <span>Question Preview</span>
            </CardTitle>
            <CardDescription>
              Preview of the first few generated questions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead className="min-w-80">Question</TableHead>
                    <TableHead className="min-w-32">Correct Answer</TableHead>
                    <TableHead className="min-w-24">Topic</TableHead>
                    <TableHead className="min-w-96">Explanation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {questions.slice(0, 3).map((q) => (
                    <TableRow key={q.id}>
                      <TableCell className="font-medium">{q.id}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium mb-2">{q.question}</p>
                          <div className="space-y-1">
                            {Object.entries(q.options).map(([key, option]) => (
                              <div
                                key={key}
                                className={`text-sm px-2 py-1 rounded ${
                                  key === q.correct_answer
                                    ? 'bg-green-100 text-green-800 font-medium'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {`${key}: ${option}`}
                              </div>
                            ))}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-800">
                          {q.correct_answer}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{q.topic}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {q.explanation}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> This preview shows only the first 3 questions. 
                Download the complete file to access all {(state?.questionsGenerated ?? preview.length).toLocaleString()} generated questions.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Results;
