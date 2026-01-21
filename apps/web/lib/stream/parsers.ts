import { StreamEvent } from "./types";

export class SSEParser {
  constructor() {}

  /**
   * Parse incoming SSE data and return complete events
   */
  parseChunk(chunk: string): StreamEvent[] {
    const lines = chunk.split("\n");
    const events: StreamEvent[] = [];

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const eventData = line.substring(6);
          if (eventData.trim()) {
            const parsed = this.parseEventData(eventData);
            if (parsed) {
              events.push(parsed);
            }
          }
        } catch (parseError) {
          console.error("Error parsing SSE data:", parseError, "Line:", line);
        }
      }
    }

    return events;
  }

  /**
   * Parse a single event data string into a StreamEvent
   */
  private parseEventData(eventData: string): StreamEvent | null {
    try {
      const data = JSON.parse(eventData);

      // Validate required event structure
      if (!data.event) {
        console.warn('Stream event missing required "event" field:', data);
        return null;
      }

      // Add timestamp if not present
      if (!data.timestamp) {
        data.timestamp = Date.now();
      }

      return data as StreamEvent;
    } catch (error) {
      console.error("Failed to parse event data as JSON:", error, eventData);
      return null;
    }
  }
}

/**
 * Utility function for simple SSE parsing without class instantiation
 */
export function parseSSEChunk(chunk: string): StreamEvent[] {
  const parser = new SSEParser();
  return parser.parseChunk(chunk);
}

/**
 * Create a streaming parser for use with fetch responses
 */
export async function createStreamParser(
  response: Response,
  onEvent: (event: StreamEvent) => void
): Promise<void> {
  if (!response.body) {
    throw new Error("No response body available for streaming");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parser = new SSEParser();

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      const events = parser.parseChunk(chunk);

      // Process each parsed event
      for (const event of events) {
        onEvent(event);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Validate a stream event structure
 */
export function validateStreamEvent(data: any): data is StreamEvent {
  if (!data || typeof data !== "object") {
    return false;
  }

  if (!data.event || typeof data.event !== "string") {
    return false;
  }

  // Additional validation for specific event types can be added here
  return true;
}

/**
 * Create a mock stream event (useful for testing)
 */
export function createMockEvent<T extends StreamEvent>(
  eventType: T["event"],
  data?: any,
  options?: { timestamp?: number; status?: string }
): T {
  return {
    event: eventType,
    timestamp: options?.timestamp || Date.now(),
    data,
    status: options?.status,
  } as T;
}
