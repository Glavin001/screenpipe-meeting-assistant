import { cn } from "@/lib/utils"
import { ChunkOverlay } from "./floating-container-buttons"
import type { TranscriptionChunk } from "../meeting-history/types"
import type { DiffChunk } from "./hooks/handle-new-chunk"
import type { TranscriptionViewMode } from "./hooks/storage-for-live-meeting"

interface TranscriptionChunkViewProps {
    chunk: TranscriptionChunk
    transcriptionViewMode: TranscriptionViewMode
    getDisplaySpeaker: (speaker: string) => string
    getSpeakerColor: (speaker: string) => string
    onSpeakerClick: (speaker: string) => void
    onGenerateNote: (chunk: TranscriptionChunk) => void
    improvingChunks: Record<number, boolean>
    recentlyImproved: Record<number, boolean>
    editedChunk?: {
        text: string
        diffs: DiffChunk[] | null
    }
}

function DiffText({ diffs }: { diffs: DiffChunk[] | null }) {
    if (!diffs) return null
    
    return (
        <>
            {diffs.map((diff, index) => (
                <span
                    key={`${diff.value}-${index}`}
                    className={cn(
                        diff.added && "text-green-600 bg-green-50",
                        diff.removed && "text-red-600 bg-red-50 line-through"
                    )}
                >
                    {diff.value}
                </span>
            ))}
        </>
    )
}

export function TranscriptionChunkView({
    chunk,
    transcriptionViewMode,
    getDisplaySpeaker,
    getSpeakerColor,
    onSpeakerClick,
    onGenerateNote,
    improvingChunks,
    recentlyImproved,
    editedChunk
}: TranscriptionChunkViewProps) {
    const formatSpeaker = (speaker: string | number) => {
        return typeof speaker === 'number' ? `speaker ${speaker}` : speaker
    }

    const showDiffs = true; // TODO: move to central state

    const chunkContent = (
        <div className={cn(
            "outline-none rounded px-1 -mx-1",
            improvingChunks[chunk.id] && "animate-shimmer bg-gradient-to-r from-transparent via-gray-100/50 to-transparent bg-[length:200%_100%]",
            recentlyImproved[chunk.id] && "animate-glow"
        )}
        style={{
            borderLeft: chunk.speaker ? `3px solid ${getSpeakerColor(chunk.speaker)}` : undefined
        }}
        >
            {editedChunk?.diffs && showDiffs ? (
                <DiffText diffs={editedChunk.diffs} />
            ) : editedChunk?.text || chunk.text}
        </div>
    )

    if (transcriptionViewMode === 'overlay') {
        return (
            <>
                <ChunkOverlay
                    timestamp={chunk.timestamp}
                    speaker={chunk.speaker}
                    displaySpeaker={chunk.speaker ? getDisplaySpeaker(chunk.speaker) : 'speaker_0'}
                    onSpeakerClick={() => {
                        if (chunk.speaker) {
                            onSpeakerClick(chunk.speaker)
                        }
                    }}
                    onGenerateNote={() => onGenerateNote(chunk)}
                />
                <div className="relative">
                    {chunkContent}
                </div>
            </>
        )
    }

    if (transcriptionViewMode === 'timestamp') {
        return (
            <div className="flex gap-1">
                <div className="w-16 flex-shrink-0 text-xs text-gray-500">
                    <div>{new Date(chunk.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    {chunk.speaker !== undefined && (
                        <button
                            type="button"
                            onClick={() => onSpeakerClick(chunk.speaker || '')}
                            className="hover:bg-gray-100 rounded-sm transition-colors"
                        >
                            {formatSpeaker(getDisplaySpeaker(chunk.speaker))}
                        </button>
                    )}
                </div>
                <div className="flex-grow pl-1">
                    {chunkContent}
                </div>
            </div>
        )
    }

    // Default speaker view
    return (
        <div className="flex gap-2">
            <div className="w-16 flex-shrink-0 text-xs text-gray-500 flex items-start">
                {chunk.speaker !== undefined && (
                    <button
                        type="button"
                        onClick={() => onSpeakerClick(chunk.speaker || '')}
                        className="hover:bg-gray-100 rounded-sm transition-colors text-left w-full"
                    >
                        {formatSpeaker(getDisplaySpeaker(chunk.speaker))}
                    </button>
                )}
            </div>
            <div className="flex-grow pl-1">
                {chunkContent}
            </div>
        </div>
    )
}
