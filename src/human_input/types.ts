/**
 * Types for human input handling in MCP Agent
 */

export enum HumanInputType {
  TEXT = 'text',
  CHOICE = 'choice',
  FILE = 'file',
  CONFIRMATION = 'confirmation'
}

export interface HumanInputPrompt {
  /** The type of input requested */
  type: HumanInputType;
  /** A message to display to the user */
  message: string;
  /** Additional data specific to the input type */
  data?: HumanInputData;
  /** Optional timeout in seconds */
  timeout?: number;
  /** Whether the input is required or optional */
  required?: boolean;
  /** Default value if user provides no input */
  default?: any;
}

export interface HumanInputData {
  /** Options for choice input */
  options?: string[];
  /** Validation pattern for text input */
  pattern?: string;
  /** Help text */
  help?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the input should be masked (for passwords) */
  masked?: boolean;
  /** File extensions to accept */
  fileExtensions?: string[];
  /** Maximum file size in bytes */
  maxFileSize?: number;
}

export interface HumanInputResult {
  /** The type of input that was provided */
  type: HumanInputType;
  /** The value that the user provided */
  value: any;
  /** Whether the input was successful */
  success: boolean;
  /** Error message if input failed */
  error?: string;
  /** Timestamp when the input was provided */
  timestamp: number;
}

export interface FileInputResult extends HumanInputResult {
  /** The file content */
  content: string | ArrayBuffer;
  /** The file name */
  filename: string;
  /** The file size in bytes */
  size: number;
  /** The file MIME type */
  mimeType: string;
}

export interface ChoiceInputResult extends HumanInputResult {
  /** The choice that was selected */
  value: string;
  /** The index of the choice that was selected */
  index: number;
}