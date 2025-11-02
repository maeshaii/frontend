/**
 * Message deduplication utilities for handling REST/WebSocket race conditions
 */

import { FileCategory } from './fileUtils';

export interface UiMessage {
  id: string;
  content: string;
  sender_id: number;
  sender_name: string;
  sender_avatar?: string | null;
  created_at: string;
  is_read: boolean;
  tempId?: string;
  message_type?: string;
  attachment_url?: string | null;
  attachment_info?: {
    file_name?: string;
    file_type?: string;
    file_category?: FileCategory;
    file_size?: number;
  };
  sequence_number?: number;
  microsecond_timestamp?: number;
}

/**
 * Deduplicate messages based on ID, content, timestamp, and sender
 * Prioritizes messages with actual IDs over temporary IDs
 * Uses sequence numbers for proper ordering when available
 */
export function deduplicateMessages(messages: UiMessage[]): UiMessage[] {
  const messageMap = new Map<string, UiMessage>();
  const seenKeys = new Set<string>();

  // Sort messages by sequence number first, then by timestamp
  const sortedMessages = [...messages].sort((a, b) => {
    // First try sequence number if available
    const aSeq = a.sequence_number;
    const bSeq = b.sequence_number;
    
    if (aSeq && bSeq) {
      return aSeq - bSeq;
    }
    
    // Fallback to timestamp
    const aTime = a.microsecond_timestamp || new Date(a.created_at).getTime();
    const bTime = b.microsecond_timestamp || new Date(b.created_at).getTime();
    
    return aTime - bTime;
  });

  for (const message of sortedMessages) {
    // Create a unique key for deduplication
    const dedupeKey = `${message.content}_${message.created_at}_${message.sender_id}`;
    
    // If we've seen this exact message before, skip it
    if (seenKeys.has(dedupeKey)) {
      continue;
    }

    // Check for sequence number duplicates first
    if (message.sequence_number) {
      const existingWithSeq = Array.from(messageMap.values()).find(
        m => m.sequence_number === message.sequence_number
      );
      if (existingWithSeq) {
        // Keep the first message with this sequence number
        continue;
      }
    }

    // Check if we already have a message with this ID
    if (messageMap.has(message.id)) {
      const existing = messageMap.get(message.id)!;
      
      // Prioritize messages with real IDs over temporary IDs
      if (message.tempId && !existing.tempId) {
        // Keep the existing message (real ID) over the new one (temp ID)
        continue;
      } else if (!message.tempId && existing.tempId) {
        // Replace temp message with real message
        messageMap.set(message.id, message);
        seenKeys.add(dedupeKey);
        continue;
      }
      
      // If both have the same ID type, keep the first one
      continue;
    }

    // Add the message
    messageMap.set(message.id, message);
    seenKeys.add(dedupeKey);
  }

  // Convert back to array and sort by sequence number or timestamp
  return Array.from(messageMap.values()).sort((a, b) => {
    // First try sequence number if available
    const aSeq = a.sequence_number;
    const bSeq = b.sequence_number;
    
    if (aSeq && bSeq) {
      return aSeq - bSeq;
    }
    
    // Fallback to timestamp
    const aTime = a.microsecond_timestamp || new Date(a.created_at).getTime();
    const bTime = b.microsecond_timestamp || new Date(b.created_at).getTime();
    
    return aTime - bTime;
  });
}

/**
 * Add a new message to the existing list with deduplication
 */
export function addMessageWithDeduplication(
  existingMessages: UiMessage[], 
  newMessage: UiMessage
): UiMessage[] {
  return deduplicateMessages([...existingMessages, newMessage]);
}

/**
 * Replace a temporary message with a saved message
 */
export function replaceTempMessage(
  messages: UiMessage[], 
  tempId: string, 
  savedMessage: UiMessage
): UiMessage[] {
  return messages.map(message => 
    message.tempId === tempId ? savedMessage : message
  );
}

/**
 * Remove a temporary message (e.g., on send failure)
 */
export function removeTempMessage(
  messages: UiMessage[], 
  tempId: string
): UiMessage[] {
  return messages.filter(message => message.tempId !== tempId);
}

/**
 * Check if a message is a duplicate based on content and timing
 */
export function isDuplicateMessage(
  existingMessages: UiMessage[], 
  newMessage: UiMessage,
  timeWindowMs: number = 5000
): boolean {
  const newMessageTime = new Date(newMessage.created_at).getTime();
  
  return existingMessages.some(existing => {
    const existingTime = new Date(existing.created_at).getTime();
    const timeDiff = Math.abs(newMessageTime - existingTime);
    
    return (
      existing.content === newMessage.content &&
      existing.sender_id === newMessage.sender_id &&
      timeDiff < timeWindowMs
    );
  });
}

/**
 * Detect sequence gaps in messages and return gap information
 */
export function detectSequenceGaps(messages: UiMessage[]): Array<{start: number, end: number, size: number}> {
  const gaps: Array<{start: number, end: number, size: number}> = [];
  
  // Filter messages that have sequence numbers
  const sequencedMessages = messages
    .filter(m => m.sequence_number !== undefined)
    .sort((a, b) => (a.sequence_number || 0) - (b.sequence_number || 0));
  
  if (sequencedMessages.length < 2) {
    return gaps;
  }
  
  for (let i = 1; i < sequencedMessages.length; i++) {
    const current = sequencedMessages[i].sequence_number || 0;
    const previous = sequencedMessages[i - 1].sequence_number || 0;
    
    if (current - previous > 1) {
      gaps.push({
        start: previous + 1,
        end: current - 1,
        size: current - previous - 1
      });
    }
  }
  
  return gaps;
}

/**
 * Sort messages by sequence number with proper ordering
 */
export function sortMessagesBySequence(messages: UiMessage[]): UiMessage[] {
  return [...messages].sort((a, b) => {
    // First try sequence number if available
    const aSeq = a.sequence_number;
    const bSeq = b.sequence_number;
    
    if (aSeq && bSeq) {
      return aSeq - bSeq;
    }
    
    // Fallback to timestamp
    const aTime = a.microsecond_timestamp || new Date(a.created_at).getTime();
    const bTime = b.microsecond_timestamp || new Date(b.created_at).getTime();
    
    return aTime - bTime;
  });
}

