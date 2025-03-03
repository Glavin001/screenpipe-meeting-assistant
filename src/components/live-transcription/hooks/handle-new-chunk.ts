import type { TranscriptionChunk, Note } from "../../meeting-history/types"
import type { LiveMeetingData, Question } from "./storage-for-live-meeting"
import { improveTranscription } from './ai-improve-chunk-transcription'
import { generateMeetingNote } from './ai-create-note-based-on-chunk'
import { diffWords } from 'diff'
import type { Settings } from "@screenpipe/browser"
import randomColor from 'randomcolor'
import { extractAnswersFromTranscript } from "./ai-answer-questions-from-chunk"

export interface DiffChunk {
    value: string
    added?: boolean
    removed?: boolean
}

export interface ImprovedChunk {
    text: string
    diffs: DiffChunk[] | null
}

interface HandleNewChunkDeps {
    setData: (fn: (currentData: LiveMeetingData | null) => LiveMeetingData | null) => void
    setImprovingChunks: (fn: (prev: Record<number, boolean>) => Record<number, boolean>) => void
    setRecentlyImproved: (fn: (prev: Record<number, boolean>) => Record<number, boolean>) => void
    updateStore: (newData: LiveMeetingData) => Promise<boolean>
    settings: Settings
}

export function createHandleNewChunk(deps: HandleNewChunkDeps) {
    const { setData, setImprovingChunks, setRecentlyImproved, updateStore, settings } = deps
    // console.log('createHandleNewChunk', settings)
    const processingChunks = new Set<number>()
    let isProcessing = false
    
    // Add buffer for raw chunks
    const noteBuffer: TranscriptionChunk[] = []

    // FIXME: Hacky workaround because we can't get the latest data without recreating instance of createHandleNewChunk
    const getData = <T>(transform: (data: LiveMeetingData | null) => T): T => {
        let transformedData: T = transform(null)
        setData(data => {
            transformedData = transform(data)
            console.log('getData transformedData', transformedData, data)
            return data
        })
        return transformedData
    }
    
    async function tryGenerateNote() {
        const now = Date.now()
        const totalText = noteBuffer.map(chunk => chunk.text).join(' ')
        const wordCount = totalText.split(/\s+/).length
        
        console.log('note generation check:', {
            bufferedChunks: noteBuffer.length,
            wordCount,
            meetsWordThreshold: wordCount >= 50,
            bufferContent: totalText
        })

        // Get current data to check if AI notes are enabled
        const { shouldGenerate, existingNotes } = getData((data) => ({
            shouldGenerate: data?.isAiNotesEnabled ?? true,
            existingNotes: data?.notes?.map((n) => n.text) || []
        }))

        // Early return if AI notes are disabled
        if (!shouldGenerate || wordCount < 50) {
            console.warn('skipping note generation - AI notes are disabled or word count is too low', {
                shouldGenerate,
                wordCount,
                meetsWordThreshold: wordCount >= 50,
                bufferContent: totalText
            })
            return
        }

        const note = await generateMeetingNote(
            noteBuffer, 
            settings,
            existingNotes
        ).catch(error => {
            console.error('failed to generate note:', error)
            return null
        })

        setData(current => {
            if (note && current) {
                const timestamp = noteBuffer.length > 0 
                    ? new Date(noteBuffer[0].timestamp)
                    : new Date(now)

                const newData = {
                    ...current,
                    notes: [...current.notes, {
                        id: `note-${now}`,
                        text: `• ${note}`,
                        timestamp,
                        type: 'auto'
                    }]
                }
                void updateStore(newData)
                return newData
            }
            return current
        })
        // Clear buffer after successful note generation
        noteBuffer.length = 0
    }

    async function tryExtractAnswers() {
        const questions = getData((data) => data?.questions || [])
        
        if (questions.length === 0) {
            console.log('skipping extract answers - no questions')
            return
        }
        
        const fullText = noteBuffer.map(chunk => chunk.text).join(' ')
        const lastChunk = noteBuffer[noteBuffer.length - 1]
        const lastChunkDate = new Date(lastChunk.timestamp)
        const wordCount = fullText.split(/\s+/).length
        
        // Get current data to check if AI notes are enabled
        const { shouldGenerate, existingNotes, mergedChunks } = getData((data) => ({
            shouldGenerate: data?.isAiNotesEnabled ?? true,
            existingNotes: data?.notes?.map((n) => n.text) || [],
            mergedChunks: data?.mergedChunks || []
        }))

        const minWordsToProcess = 20
        console.log('extract answers check:', {
            lastChunkDate,
            questions,
            existingNotes,
            mergedChunks,
            shouldGenerate,
            bufferedChunks: noteBuffer.length,
            wordCount,
            meetsWordThreshold: wordCount >= minWordsToProcess,
            bufferContent: fullText
        })


        // Early return if AI notes are disabled
        if (!shouldGenerate || wordCount < minWordsToProcess) {
            console.warn('skipping extract answers - AI notes are disabled or word count is too low', {
                shouldGenerate,
                wordCount,
                meetsWordThreshold: wordCount >= minWordsToProcess,
                bufferContent: fullText
            })
            return
        }

        const previousTranscript = mergedChunks.map(chunk => chunk.text).join(' ')

        const answers = await extractAnswersFromTranscript(
            previousTranscript,
            fullText,
            questions,
            settings
        )

        console.log('extract answers:', answers)

        // Process any non-empty answers and update the corresponding questions
        if (answers.answers && answers.answers.length > 0) {
            const nonEmptyAnswers = answers.answers.filter(answer => 
                answer.extractedAnswer && answer.extractedAnswer.trim() !== ''
            );
            
            if (nonEmptyAnswers.length > 0) {
                console.log('found non-empty answers:', nonEmptyAnswers);
                
                setData(currentData => {
                    if (!currentData) return null;
                    
                    // Create a new note for each answer
                    const newNotes: Note[] = nonEmptyAnswers.map((answer) => ({
                        id: crypto.randomUUID(),
                        text: answer.extractedAnswer,
                        timestamp: lastChunkDate,
                        isAiGenerated: true
                    }));
                    
                    // Update questions with answers
                    const updatedQuestions: Question[] = currentData.questions.map((question: Question): Question => {
                        const matchingAnswer = nonEmptyAnswers.find(answer => answer.id === question.id);
                        if (matchingAnswer) {
                            // Find the new note that corresponds to this answer
                            const answerIndex = nonEmptyAnswers.findIndex(answer => answer.id === question.id);
                            const answerNote = answerIndex >= 0 ? [newNotes[answerIndex]] : []; // FIXME: ensure can handle appending multiple answers
                            
                            return {
                                ...question,
                                status: 'answered',
                                answer: answerNote
                            };
                        }
                        return question;
                    });
                    
                    // Combine existing notes with new answer notes
                    const allNotes: Note[] = [...currentData.notes, ...newNotes];
                    
                    return {
                        ...currentData,
                        notes: allNotes,
                        questions: updatedQuestions
                    };
                });
            }
        }
    }

    return async function handleNewChunk(chunk: TranscriptionChunk) {
        if (isProcessing) {
            console.log('skipping chunk processing - already processing another chunk')
            return
        }

        isProcessing = true
        try {
            // Add new chunk to note buffer immediately
            noteBuffer.push(chunk)
            // void tryGenerateNote()
            void tryExtractAnswers();

            setData(currentData => {
                if (!currentData) return null

                const chunks = [...currentData.chunks, chunk]
                
                const mergedChunks = chunks.reduce<TranscriptionChunk[]>((acc, curr) => {
                    const prev = acc[acc.length - 1]
                    
                    if (prev && prev.speaker === curr.speaker) {
                        prev.text += ' ' + curr.text
                        return acc
                    }
                    
                    acc.push(Object.assign({}, curr))
                    return acc
                }, [])
                // Get the second-to-last merged chunk (if available)
                const previousMerged = mergedChunks.length > 1 ? mergedChunks[mergedChunks.length - 2] : null
                
                // Check if we should process this chunk with AI
                const hasValidPreviousChunk = previousMerged !== null;
                const isUsingScreenpipeCloud = settings.aiProviderType === "screenpipe-cloud";
                const isChunkNotImproved = previousMerged && !currentData.editedMergedChunks[previousMerged.id];
                const isChunkNotProcessing = previousMerged ? !processingChunks.has(previousMerged.id) : true;
                const isAiNotesEnabled = currentData.isAiNotesEnabled;
                
                const shouldProcessWithAI =
                    isAiNotesEnabled && 
                    hasValidPreviousChunk && 
                    isUsingScreenpipeCloud && 
                    isChunkNotImproved &&
                    isChunkNotProcessing;
                
                if (shouldProcessWithAI) {
                    console.log('processing chunk:', { id: previousMerged.id, text: previousMerged.text })
                    processingChunks.add(previousMerged.id)
                    setImprovingChunks((prev: Record<number, boolean>) => ({ ...prev, [previousMerged.id]: true }))
                    
                    const context = {
                        meetingTitle: currentData.title || '',
                        recentChunks: mergedChunks.slice(-3),
                        notes: currentData.notes.map(note => note.text)
                    }
                    
                    void improveTranscription(previousMerged.text, context, settings)
                        .then(improved => {
                            const diffs = diffWords(previousMerged.text, improved)
                            
                            processingChunks.delete(previousMerged.id)
                            setImprovingChunks((prev: Record<number, boolean>) => {
                                const next = { ...prev }
                                delete next[previousMerged.id]
                                return next
                            })
                            setRecentlyImproved((prev: Record<number, boolean>) => ({ ...prev, [previousMerged.id]: true }))

                            setData(current => {
                                if (!current) return null
                                const newData = {
                                    ...current,
                                    editedMergedChunks: {
                                        ...current.editedMergedChunks,
                                        [previousMerged.id]: {
                                            text: improved,
                                            diffs
                                        }
                                    }
                                }
                                void updateStore(newData)
                                return newData
                            })

                            if (improved) {
                                const improvedChunk = {
                                    ...previousMerged,
                                    text: improved
                                }
                                noteBuffer.push(improvedChunk)
                                // void tryGenerateNote()
                                void tryExtractAnswers()
                            }

                            setTimeout(() => {
                                setRecentlyImproved(prev => {
                                    const next = { ...prev }
                                    delete next[previousMerged.id]
                                    return next
                                })
                            }, 5000)
                        })
                        .catch(error => {
                            console.error('failed to improve chunk:', error)
                            processingChunks.delete(previousMerged.id)
                            setImprovingChunks(prev => {
                                const next = { ...prev }
                                delete next[previousMerged.id]
                                return next
                            })
                        })
                } else {
                    console.log('skipping chunk processing - AI notes are disabled or chunk is not suitable for AI processing', {
                        shouldProcessWithAI,
                        previousMerged,
                        hasValidPreviousChunk,
                        isUsingScreenpipeCloud,
                        isChunkNotImproved,
                        isChunkNotProcessing,
                        isAiNotesEnabled,
                        processingChunks,
                        editedMergedChunks: currentData.editedMergedChunks,
                        currentData,
                    })
                }

                const newData: LiveMeetingData = {
                    ...currentData,
                    chunks,
                    mergedChunks,
                    lastProcessedIndex: chunks.length
                }
                
                // Ensure speakerColors exists and add color for any new speakers
                if (!newData.speakerColors) {
                    newData.speakerColors = {}
                }
                
                // Check if current chunk's speaker needs a color
                if (chunk.speaker && !newData.speakerColors[chunk.speaker]) {
                    newData.speakerColors[chunk.speaker] = randomColor({
                        luminosity: 'dark',
                        format: 'hex',
                        // seed: chunk.speaker
                    })
                }
                
                void updateStore(newData)
                return newData
            })
        } finally {
            isProcessing = false
        }
    }
}
