'use client'

import { useState, memo } from 'react'
import { CheckCircle2, XCircle, Clock, AlertCircle, Plus, Edit2, Trash2, ArrowUp, ArrowDown } from 'lucide-react'
import type { Note } from '../meeting-history/types'
import { useMeetingContext, type Question, type QuestionStatus } from './hooks/storage-for-live-meeting'
import { useSettings } from '@/lib/hooks/use-settings'
import { useToast } from '@/hooks/use-toast'
import { TextEditor } from './text-editor-within-notes-editor'
import { Button } from '@/components/ui/button'

interface Props {
  onTimeClick: (timestamp: Date) => void
}

const statusIcons = {
  open: AlertCircle,
  inProgress: Clock,
  answered: CheckCircle2,
  skipped: XCircle,
}

const statusColors = {
  open: 'text-yellow-500',
  inProgress: 'text-blue-500',
  answered: 'text-green-500',
  skipped: 'text-red-500',
}

export const QuestionsEditor = memo(function QuestionsEditor({ onTimeClick }: Props) {
  const { questions, setQuestions, notes } = useMeetingContext()
  const { settings } = useSettings()
  const { toast } = useToast()
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null)
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null)
  const [editText, setEditText] = useState("")

  const updateQuestionStatus = (questionId: string, newStatus: QuestionStatus) => {
    setQuestions(
      questions.map(q =>
        q.id === questionId
          ? { ...q, status: newStatus }
          : q
      )
    )
  }

  const attachAnswerToQuestion = (questionId: string, notes: Note[]) => {
    setQuestions(
      questions.map(q =>
        q.id === questionId
          ? { ...q, answer: notes, status: 'answered' }
          : q
      )
    )
    setSelectedQuestionId(null)
  }

  const skipQuestion = (questionId: string) => {
    updateQuestionStatus(questionId, 'skipped')
    toast({
      title: "Question Skipped",
      description: "The question has been marked as skipped.",
    })
  }

  const startAnswering = (questionId: string) => {
    updateQuestionStatus(questionId, 'inProgress')
    setSelectedQuestionId(questionId)
  }

  const addNewQuestion = () => {
    const newQuestion: Question = {
      id: crypto.randomUUID(),
      text: '',
      status: 'open',
      answer: null
    }
    setQuestions([...questions, newQuestion])
    setEditingQuestionId(newQuestion.id)
    setEditText('')
  }

  const editQuestion = (question: Question) => {
    setEditingQuestionId(question.id)
    setEditText(question.text)
  }

  const saveQuestionEdit = () => {
    if (!editingQuestionId) return
    setQuestions(
      questions.map(q =>
        q.id === editingQuestionId
          ? { ...q, text: editText }
          : q
      )
    )
    setEditingQuestionId(null)
    setEditText("")
  }

  const deleteQuestion = (questionId: string) => {
    setQuestions(questions.filter(q => q.id !== questionId))
    toast({
      title: "Question Deleted",
      description: "The question has been removed.",
    })
  }

  const updateAnswer = (questionId: string, updatedNotes: Note[]) => {
    setQuestions(
      questions.map(q =>
        q.id === questionId
          ? { ...q, answer: updatedNotes }
          : q
      )
    )
  }

  const moveQuestionUp = (index: number) => {
    if (index === 0) return // Already at the top
    
    const newQuestions = [...questions]
    const temp = newQuestions[index]
    newQuestions[index] = newQuestions[index - 1]
    newQuestions[index - 1] = temp
    
    setQuestions(newQuestions)
  }

  const moveQuestionDown = (index: number) => {
    if (index === questions.length - 1) return // Already at the bottom
    
    const newQuestions = [...questions]
    const temp = newQuestions[index]
    newQuestions[index] = newQuestions[index + 1]
    newQuestions[index + 1] = temp
    
    setQuestions(newQuestions)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="text-lg font-semibold">Meeting Questions</h2>
        <Button onClick={addNewQuestion} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Question
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {questions.map((question, index) => {
          const StatusIcon = statusIcons[question.status]
          const statusColor = statusColors[question.status]
          const isSelected = selectedQuestionId === question.id
          const isEditing = editingQuestionId === question.id
          const hasAnswer = Boolean(question.answer?.length)

          return (
            <div
              key={question.id}
              className={`border rounded-lg p-4 ${
                isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1">
                  <StatusIcon className={`w-5 h-5 ${statusColor}`} />
                  {isEditing ? (
                    <div className="flex-1">
                      <input
                        type="text"
                        value={editText}
                        placeholder="Enter question"
                        onChange={(e) => setEditText(e.target.value)}
                        onBlur={saveQuestionEdit}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveQuestionEdit()
                          if (e.key === 'Escape') {
                            setEditingQuestionId(null)
                            setEditText("")
                          }
                        }}
                        className="w-full p-1 border rounded"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <span className="font-medium flex-1">{question.text}</span>
                  )}
                </div>
                <div className="flex gap-2">
                  {!isEditing && (
                    <>
                      <div className="flex gap-1 mr-2">
                        <button
                          onClick={() => moveQuestionUp(index)}
                          disabled={index === 0}
                          className={`p-1 ${index === 0 ? 'text-gray-300' : 'text-gray-500 hover:text-blue-500'}`}
                          type="button"
                          aria-label="Move question up"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => moveQuestionDown(index)}
                          disabled={index === questions.length - 1}
                          className={`p-1 ${index === questions.length - 1 ? 'text-gray-300' : 'text-gray-500 hover:text-blue-500'}`}
                          type="button"
                          aria-label="Move question down"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                      </div>
                      <button
                        onClick={() => editQuestion(question)}
                        className="p-1 text-gray-500 hover:text-blue-500"
                        type="button"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteQuestion(question.id)}
                        className="p-1 text-gray-500 hover:text-red-500"
                        type="button"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  {question.status === 'open' && !isEditing && (
                    <>
                      <button
                        onClick={() => startAnswering(question.id)}
                        className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                        type="button"
                      >
                        Start
                      </button>
                      <button
                        onClick={() => skipQuestion(question.id)}
                        className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
                        type="button"
                      >
                        Skip
                      </button>
                    </>
                  )}
                  {question.status === 'inProgress' && !isEditing && hasAnswer && (
                    <button
                      onClick={() => attachAnswerToQuestion(question.id, notes)}
                      className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                      type="button"
                    >
                      Complete
                    </button>
                  )}
                  {question.status === 'skipped' && !isEditing && (
                    <button
                      onClick={() => updateQuestionStatus(question.id, 'open')}
                      className="px-3 py-1 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600"
                      type="button"
                    >
                      Un-skip
                    </button>
                  )}
                  {question.status === 'inProgress' && !isEditing && !hasAnswer && (
                    <button
                      onClick={() => updateQuestionStatus(question.id, 'open')}
                      className="px-3 py-1 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600"
                      type="button"
                    >
                      Pause
                    </button>
                  )}
                </div>
              </div>
              {(question.answer && question.answer.length > 0) || 
               (question.status !== 'open' && question.status !== 'skipped') ? (
                <div className="mt-4">
                  <TextEditor
                    notes={question.answer || []}
                    setNotes={(notes) => updateAnswer(question.id, notes)}
                    onTimeClick={onTimeClick}
                  />
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
})
