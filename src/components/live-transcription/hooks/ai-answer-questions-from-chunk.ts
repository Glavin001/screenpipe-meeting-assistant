import type { Question } from "./storage-for-live-meeting"
import type { Settings } from "@screenpipe/browser"
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import { callOpenAI, callOpenAIStructured, createAiClient } from "./ai-client"

// Define the response schema for question extraction
const QuestionAnswer = z.object({
    id: z.string().describe("The unique identifier of the question"),
    extractedAnswer: z.string().describe("The extracted answer for the question from the transcript. Must be an empty string if no answer is found in the transcript.")
});

const QuestionExtractionResponse = z.object({
    answers: z.array(QuestionAnswer).describe("Array of extracted answers for each question. May be empty if no answers were found. Each question without an answer in the transcript should have an empty string as extractedAnswer.")
});

type QuestionExtractionResult = z.infer<typeof QuestionExtractionResponse>;

/**
 * Extract answers to questions from a transcript
 * @param transcript The transcript text to analyze
 * @param questions List of questions to find answers for
 * @param settings Application settings
 * @returns Promise with an array of question IDs and their extracted answers
 */
export async function extractAnswersFromTranscript(
    previousTranscript: string,
    newTranscript: string,
    questions: Question[],
    settings: Settings
): Promise<QuestionExtractionResult> {
    if (!previousTranscript || !newTranscript || !questions.length) {
        return { answers: [] };
    }

    const openai = createAiClient(settings);
    
    // Format questions for the prompt
    const questionsText = questions
        // .filter(q => q.status === 'open' || q.status === 'inProgress')
        .filter(q => q.text.trim() !== '')
        .map(q => `- Question ID "${q.id}": ${q.text}`)
        .join('\n');
    
    if (!questionsText) {
        return { answers: [] };
    }

    try {
        // const response = await callOpenAIStructured<z.infer<typeof QuestionExtractionResponse>>(
        const response = await callOpenAI(
            openai,
            {
                model: settings.aiModel,
                messages: [
                    {
                        role: "system",
                        // biome-ignore lint/style/useTemplate: <explanation>
                        content: `You are an expert at analyzing meeting transcripts and extracting answers to specific questions.
                        For each question, extract the most relevant information from the transcript that answers it.
                        If a question has no answer in the transcript, return an empty string for that question's extractedAnswer.
                        Be concise but complete in your extracted answers.`
                        + `\n\nThe response must be in JSON format and match the following schema:
                        ${JSON.stringify(zodResponseFormat(QuestionExtractionResponse, 'question_extraction').json_schema.schema?.properties)}`
                    },
                    {
                        role: "user",
                        content: `Extract from the new transcript answers to the following questions:
                        
                        ${questionsText}
                        
                        Previous transcript for context:
                        ${previousTranscript}
                        
                        New transcript to extract answers from:
                        ${newTranscript}`
                    }
                ],
                temperature: 0.3,
                // response_format: { type: "json_object" },
                // response_format: zodResponseFormat(QuestionExtractionResponse, 'question_extraction')
            },
            {
                maxRetries: 2,
                initialDelay: 1000
            }
        );

        console.log('extract answers response:', response)

        // Handle both streaming and non-streaming responses
        try {
            if (response && 'choices' in response && Array.isArray(response.choices)) {
                const textContent = response.choices[0]?.message?.content
                if (textContent) {
                    const parsed = JSON.parse(textContent)
                    // return parsed
                    return { answers: parsed.answers || [] }
                }
            }
        } catch (error) {
            console.error('Failed to parse response:', error);
        }
        return { answers: [] };
        // return { answers: response.answers || [] };
    } catch (error) {
        console.error('Failed to extract answers from transcript:', error);
        return { answers: [] };
    }
}
