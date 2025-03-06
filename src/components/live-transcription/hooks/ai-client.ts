import { OpenAI } from "openai"
import type { Settings } from "@screenpipe/browser"
import pThrottle from "p-throttle"

interface RetryOptions {
    maxRetries?: number
    initialDelay?: number
}

// Add rate limit tracking
const rateLimitState = {
    isLimited: false,
    resetTime: 0,
    backoffUntil: 0
}

// Update throttle to be more conservative
const throttle = pThrottle({
    limit: 2, // reduced from 3
    interval: 2000, // increased from 1000
})

export function createAiClient(settings: Settings) {
    return new OpenAI({
        apiKey: settings.aiProviderType === "screenpipe-cloud" 
            ? settings.user.token 
            : settings.openaiApiKey,
        baseURL: settings.aiUrl,
        dangerouslyAllowBrowser: true,
    })
}

// Generic retry helper for OpenAI API calls
export async function withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const { maxRetries = 3, initialDelay = 1000 } = options
    let lastError: unknown = null
    
    // Check if we're in backoff period
    if (Date.now() < rateLimitState.backoffUntil) {
        throw new Error('rate limit backoff in progress')
    }
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn()
        } catch (error) {
            lastError = error
            const typedError = error as { status?: number; message?: string; type?: string }
            
            console.warn(`API call failed (attempt ${attempt + 1}/${maxRetries}):`, {
                error: typedError.message,
                status: typedError.status,
                type: typedError.type
            })

            if (typedError.status === 429) { // Rate limit
                rateLimitState.isLimited = true
                rateLimitState.backoffUntil = Date.now() + (initialDelay * (2 ** attempt))
                console.log(`rate limit hit, backing off until ${new Date(rateLimitState.backoffUntil).toISOString()}`)
                throw error // Don't retry on rate limit, let caller handle
            }
            
            if (typedError.status === 503) { // Service unavailable
                const delay = initialDelay * (1.5 ** attempt)
                await new Promise(resolve => setTimeout(resolve, delay))
                continue
            }

            // Don't retry on auth errors or invalid requests
            if (typedError.status === 401 || typedError.status === 400) {
                throw error
            }
        }
    }
    
    throw lastError || new Error('max retries exceeded')
}

// Throttled wrapper for OpenAI calls with retry logic
export const callOpenAI = throttle(async (
    openai: OpenAI,
    params: Parameters<typeof openai.chat.completions.create>[0],
    options: RetryOptions = {}
) => {
    return withRetry(() => openai.chat.completions.create(params), options)
})

// Structured output helper using OpenAI's completion_parse
export const callOpenAIStructured = throttle(async <T>(
    openai: OpenAI,
    params: Parameters<typeof openai.chat.completions.create>[0],
    options: RetryOptions = {}
) => {
    return withRetry(async () => {
        // Ensure response_format is set to json_object if not already specified
        const paramsWithFormat = {
            ...params,
            response_format: params.response_format || { type: "json_object" }
        };
        
        const response = await openai.chat.completions.create(paramsWithFormat);
        
        try {
            console.log('response', response);
            
            // Handle both streaming and non-streaming responses
            if ('choices' in response) {
                const content = response.choices[0]?.message.content;
                if (!content) throw new Error("Empty response content");
                return JSON.parse(content) as T;
            }
            throw new Error("Unexpected response format - streaming not supported for structured output");
        } catch (error) {
            throw new Error(`Failed to parse structured response: ${error}`);
        }
    }, options);
});
