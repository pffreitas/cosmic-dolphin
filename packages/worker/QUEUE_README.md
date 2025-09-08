# Supabase pgmq Queue Implementation

This implementation provides a comprehensive message queue processing system using Supabase's pgmq extension for the Cosmic Dolphin worker service.

## Features

- **Pull-based message processing** using Supabase pgmq
- **Configurable polling intervals** and batch processing
- **Extensible message handlers** with type-safe interfaces
- **Automatic retry logic** with configurable max attempts
- **Graceful shutdown** handling
- **Error handling and logging** with structured logs
- **Message archiving** for failed messages

## Architecture

### Core Components

1. **SupabaseClientService** - Manages Supabase client connection
2. **QueueService** - Handles pgmq operations (pop, archive, delete, send)
3. **QueueProcessor** - Orchestrates continuous message polling and processing
4. **MessageHandlers** - Extensible handlers for different message types

### File Structure

```
src/queue/
├── queue.module.ts                    # NestJS module configuration
├── supabase-client.service.ts         # Supabase client management
├── queue.service.ts                   # pgmq operations wrapper
├── queue.processor.ts                 # Message polling and processing
├── interfaces/
│   └── message-handler.interface.ts   # Handler interface definition
└── handlers/
    ├── default-message.handler.ts     # Fallback handler
    └── example-task.handler.ts        # Example task handler
```

## Configuration

### Environment Variables

```bash
# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Queue Configuration
QUEUE_AUTO_START=true                  # Auto-start processing on module init
QUEUE_POLL_INTERVAL=5000              # Polling interval in milliseconds
QUEUE_MAX_RETRIES=3                   # Max retry attempts per message
QUEUE_BATCH_SIZE=10                   # Messages to process per poll
QUEUE_CONCURRENCY=5                   # Concurrent processing limit
QUEUE_GRACEFUL_SHUTDOWN_TIMEOUT=30000 # Shutdown timeout in milliseconds
QUEUE_NAMES=default,tasks,notifications # Comma-separated queue names
```

## Usage

### Setting up Queues in Supabase

1. Enable the `pgmq` extension in your Supabase project
2. Navigate to Queues in the Supabase dashboard
3. Create queues (e.g., "default", "tasks", "notifications")
4. Enable "Expose Queues via PostgREST" in queue settings
5. Set up RLS policies for queue access

### Creating Custom Message Handlers

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { MessageHandler } from '../interfaces/message-handler.interface';
import { QueueMessage } from '../../types/queue.types';

@Injectable()
export class CustomTaskHandler implements MessageHandler {
  private readonly logger = new Logger(CustomTaskHandler.name);

  canHandle(messageType: string): boolean {
    return messageType === 'custom_task';
  }

  async handle(message: QueueMessage): Promise<void> {
    // Your custom processing logic here
    this.logger.log(`Processing custom task: ${message.msg_id}`);
    
    // Access message payload
    const payload = message.message;
    
    // Implement your business logic
    await this.processCustomTask(payload);
  }

  getMessageType(): string {
    return 'custom_task';
  }

  private async processCustomTask(payload: any): Promise<void> {
    // Custom task implementation
  }
}
```

### Sending Messages to Queues

```typescript
// Example: Sending a message to a queue
await queueService.sendMessage('tasks', {
  type: 'example_task',
  action: 'process_file',
  filename: 'document.pdf',
  metadata: {
    source: 'upload_handler',
    priority: 'high'
  }
});
```

### Message Format

Messages should follow this structure:

```typescript
{
  type: 'message_type',     // Used for handler routing
  action?: 'specific_action', // Optional action identifier
  data?: any,               // Payload data
  metadata?: {              // Optional metadata
    source?: string,
    priority?: 'low' | 'medium' | 'high',
    retry_count?: number
  }
}
```

## Error Handling

- **Automatic retries** for failed messages up to `QUEUE_MAX_RETRIES`
- **Message archiving** for messages that exceed retry limit
- **Structured error logging** with message context
- **Graceful degradation** for handler errors

## Monitoring

The system provides structured logging for:
- Message processing events
- Error conditions and retries
- Queue polling activities
- Graceful shutdown events

## Integration

The queue module is automatically integrated with the existing NestJS worker architecture and will start processing messages when the application starts (if `QUEUE_AUTO_START=true`).

## Development

To add new message types:

1. Create a new handler implementing `MessageHandler`
2. Add the handler to `QueueModule` providers
3. Include it in the `MESSAGE_HANDLERS` factory
4. Configure your message routing logic in `canHandle()`

The system will automatically route messages to appropriate handlers based on the message `type` field.