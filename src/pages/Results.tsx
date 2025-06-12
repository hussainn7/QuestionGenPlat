
import React from 'react';
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
}

interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  topic: string;
}

const Results: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as ResultsState;

  // Mock generated questions for preview
  const sampleQuestions: Question[] = [
    {
      id: 1,
      question: "What is the primary function of mitochondria in cells?",
      options: ["Protein synthesis", "Energy production", "DNA storage", "Waste removal"],
      correctAnswer: "Energy production",
      explanation: "Mitochondria are known as the powerhouses of the cell because they produce ATP, which is the main energy currency of cellular processes.",
      topic: "Cell Biology"
    },
    {
      id: 2,
      question: "Which programming paradigm emphasizes immutability and pure functions?",
      options: ["Object-oriented", "Functional", "Procedural", "Event-driven"],
      correctAnswer: "Functional",
      explanation: "Functional programming is a paradigm that treats computation as the evaluation of mathematical functions and avoids changing state and mutable data.",
      topic: "Programming Concepts"
    },
    {
      id: 3,
      question: "What is the time complexity of binary search algorithm?",
      options: ["O(n)", "O(log n)", "O(n²)", "O(1)"],
      correctAnswer: "O(log n)",
      explanation: "Binary search has O(log n) time complexity because it eliminates half of the remaining elements in each iteration.",
      topic: "Algorithms"
    }
  ];

  const handleDownload = (format: 'json' | 'excel') => {
    // Simulate download
    const filename = `questions_${state?.filename?.replace(/\.[^/.]+$/, "") || 'generated'}.${format === 'json' ? 'json' : 'xlsx'}`;
    console.log(`Downloading ${filename}`);
    
    // In a real app, this would trigger an actual download
    const blob = new Blob([JSON.stringify(sampleQuestions, null, 2)], { 
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
                {state.questionsGenerated.toLocaleString()}
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
                  {sampleQuestions.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell className="font-medium">{q.id}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium mb-2">{q.question}</p>
                          <div className="space-y-1">
                            {q.options.map((option, index) => (
                              <div
                                key={index}
                                className={`text-sm px-2 py-1 rounded ${
                                  option === q.correctAnswer
                                    ? 'bg-green-100 text-green-800 font-medium'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {String.fromCharCode(65 + index)}. {option}
                              </div>
                            ))}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-800">
                          {q.correctAnswer}
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
                Download the complete file to access all {state.questionsGenerated.toLocaleString()} generated questions.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Results;
