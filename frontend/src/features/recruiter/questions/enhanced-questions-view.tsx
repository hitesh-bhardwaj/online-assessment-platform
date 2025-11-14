'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Download, Plus } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useRecruiterQuestions,
  useQuestionMetadata,
  useExportQuestions,
} from '@/hooks/use-recruiter-questions';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { toast } from "sonner"

import { QuestionActions } from './question-actions';
import { QuestionStatusBadge } from './question-status-badge';
import { BatchOperationsToolbar } from './batch-operations-toolbar';

const difficultyVariant: Record<
  string,
  'outline' | 'secondary' | 'destructive'
> = {
  easy: 'outline',
  medium: 'secondary',
  hard: 'destructive',
};

export function EnhancedQuestionsView({
  basePath = '/recruiter',
}: {
  basePath?: string;
}) {
  const [search, setSearch] = useState('');
  const [difficulty, setDifficulty] = useState<string>('all');
  const [type, setType] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const limit = 10;

  const { data, isLoading, isError, error } = useRecruiterQuestions({
    search: search.trim() || undefined,
    difficulty:
      difficulty === 'all'
        ? undefined
        : (difficulty as 'easy' | 'medium' | 'hard'),
    type: type === 'all' ? undefined : (type as 'mcq' | 'msq' | 'coding'),
    status:
      status === 'all'
        ? undefined
        : (status as 'draft' | 'active' | 'archived' | 'under_review'),
    page,
    limit,
  });

  const { data: metadataData } = useQuestionMetadata();
  const metadata = metadataData?.data;
  const exportQuestions = useExportQuestions();

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const pagination = data?.pagination ?? {
    page: 1,
    limit,
    total: items.length,
    pages: 1,
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(items.map((q) => q.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectQuestion = (questionId: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, questionId]);
    } else {
      setSelectedIds(selectedIds.filter((id) => id !== questionId));
    }
  };

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      await exportQuestions.mutateAsync({
        format,
        questionIds: selectedIds.length > 0 ? selectedIds : undefined,
      });
      toast({
        title: 'Export successful',
        description: `Questions exported as ${format.toUpperCase()}`,
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        description:
          error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const byStatus = metadata?.statistics?.byStatus ?? {};
const active = Number(byStatus?.active ?? 0);
const draft = Number(byStatus?.draft ?? 0);
const total = Object.values(byStatus).reduce((a, b) => a + Number(b ?? 0), 0);
const uniqueCategories = Array.isArray(metadata?.categories) ? metadata.categories.length : 0;
console.log('metadataData ->', metadataData);

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Question Bank</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('json')}
            disabled={exportQuestions.isPending}
          >
            <Download className="mr-2 h-4 w-4" />
            Export JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('csv')}
            disabled={exportQuestions.isPending}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button asChild>
            <Link href={`${basePath}/questions/new`}>
              <Plus className="mr-2 h-4 w-4" />
              New Question
            </Link>
          </Button>
        </div>
      </div>

      {isError ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load question bank</AlertTitle>
          <AlertDescription>
            {(error as Error)?.message ?? 'Try again later.'}
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Statistics Cards */}
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
          <CardDescription>
            Question bank statistics and insights
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Questions"
            value={total}
            helper="All statuses"
          />
          <StatCard label="Active" value={active} helper="Ready for use" />
          <StatCard label="Draft" value={draft} helper="In progress" />
          <StatCard
            label="Unique Categories"
            value={uniqueCategories}
            helper="Organized domains"
          />
        </CardContent>
      </Card>

      {/* Batch Operations */}
      {selectedIds.length > 0 && (
        <BatchOperationsToolbar
          selectedIds={selectedIds}
          onClearSelection={() => setSelectedIds([])}
        />
      )}

      {/* Questions Table */}
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2">
            <CardTitle>Questions</CardTitle>
            <CardDescription>
              Filter, search, and manage your question library
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search questions..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className="w-48"
            />
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={difficulty}
              onValueChange={(value) => {
                setDifficulty(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Difficulty</SelectItem>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={type}
              onValueChange={(value) => {
                setType(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="mcq">MCQ</SelectItem>
                <SelectItem value="msq">MSQ</SelectItem>
                <SelectItem value="coding">Coding</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60">
                  <TableHead className="w-12">
                    <Checkbox
                      checked={
                        selectedIds.length === items.length && items.length > 0
                      }
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Points</TableHead>
                  <TableHead className="w-12">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                        Loading questions…
                      </div>
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                        No questions match the selected filters.
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((question) => (
                    <TableRow key={question.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(question.id)}
                          onCheckedChange={(checked) =>
                            handleSelectQuestion(
                              question.id,
                              checked as boolean
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">
                            {question.title}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Updated{' '}
                            {new Date(question.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <QuestionStatusBadge
                          status={question.status || 'active'}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            difficultyVariant[question.difficulty] ?? 'outline'
                          }
                          className="capitalize"
                        >
                          {question.difficulty}
                        </Badge>
                      </TableCell>
                      <TableCell className="capitalize">
                        {question.type}
                      </TableCell>
                      <TableCell className="capitalize">
                        {question.category || '—'}
                      </TableCell>
                      <TableCell>{question.points}</TableCell>
                      <TableCell>
                        <QuestionActions
                          questionId={question.id}
                          questionTitle={question.title}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              Showing {items.length} of {pagination.total} questions (Page{' '}
              {pagination.page} of {pagination.pages})
            </div>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      setPage((p) => Math.max(1, p - 1));
                    }}
                  />
                </PaginationItem>
                {Array.from({ length: Math.min(5, pagination.pages) }).map(
                  (_, index) => {
                    const p =
                      Math.min(
                        Math.max(1, pagination.page - 2),
                        Math.max(1, pagination.pages - 4)
                      ) + index;
                    if (p > pagination.pages) return null;
                    return (
                      <PaginationItem key={p}>
                        <PaginationLink
                          href="#"
                          isActive={p === pagination.page}
                          onClick={(event) => {
                            event.preventDefault();
                            setPage(p);
                          }}
                        >
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  }
                )}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      setPage((p) => Math.min(pagination.pages, p + 1));
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: number;
  helper: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border/70 bg-muted/40 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground/80">{helper}</p>
    </div>
  );
}
