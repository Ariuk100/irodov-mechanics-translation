// =====================================================
// Body block types (section content elements)
// =====================================================

export interface TextBlock {
  type: "text";
  value: string; // may contain inline HTML and LaTeX $...$
}

export interface HeaderBlock {
  type: "header";
  id?: string;
  value: string;
}

export interface EquationBlock {
  type: "equation";
  value: string; // LaTeX display math (no $$ delimiters)
  tag?: string;  // equation number label e.g. "1.1"
}

export interface ImageBlock {
  type: "image";
  src: string;   // relative path e.g. "images/..."
  caption?: string;
}

export interface NoteBlock {
  type: "note";
  value: string; // footnote / side note text (may contain inline LaTeX)
}

// Statement and solution contain simple body blocks (no nested problems)
export type StatementBlock = TextBlock | EquationBlock | ImageBlock | NoteBlock;

export interface ProblemBlock {
  type: "problem";
  number: string;    // e.g. "1.1"
  title: string;
  statement: StatementBlock[];
  solution: StatementBlock[];
}

export type BodyBlock =
  | TextBlock
  | HeaderBlock
  | EquationBlock
  | ImageBlock
  | NoteBlock
  | ProblemBlock;

// =====================================================
// Section, Chapter, Book, Library
// =====================================================

export interface Section {
  id: string;
  title: string;
  body: BodyBlock[];
}

export interface SectionMeta {
  id: string;
  title: string;
  file: string; // filename within the chapter folder, e.g. "1.1.json"
}

export interface ChapterMeta {
  id: string;
  title: string;
  folder: string; // e.g. "irodov-mechanics/chapter_1"
  sections: SectionMeta[];
}

export interface BookMeta {
  id: string;
  title: string;
  chapters: ChapterMeta[];
}

export interface Library {
  books: BookMeta[];
}

// =====================================================
// Firestore document shapes
// =====================================================

// Stored at: books/{bookId}/chapters/{chapterId}/sections/{sectionId}
export interface SectionDoc {
  id: string;
  title: string;
  chapterId: string;
  bookId: string;
  body: BodyBlock[];
  updatedAt?: number; // unix timestamp ms
}

// Stored at: books/{bookId}
export interface BookDoc {
  id: string;
  title: string;
  chapters: ChapterMeta[];
}

// Stored at: users/{uid}
export type UserRole = "admin" | "moderator" | "user";

export interface UserDoc {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: number;
}

// Stored at: notifications/{notifId}
export type NotifType = "new_suggestion" | "suggestion_approved" | "suggestion_rejected";
export interface NotificationDoc {
  id?: string;
  recipientUid: string;
  type: NotifType;
  title: string;
  body: string;
  read: boolean;
  createdAt: number;
  suggestionId?: string;
}

// Stored at: suggestions/{suggestionId}
export type SuggestionStatus = "pending" | "approved" | "rejected";
export type SuggestionType = "text" | "formula" | "image" | "title" | "block_delete";
export type ImageAction = "replace" | "delete" | "insert";

export interface SuggestionDoc {
  id?: string;
  type: SuggestionType;  // defaults to "text" for backward compat
  bookId: string;
  chapterId: string;
  sectionId: string;
  blockIndex: number;    // index of the block in body[] — for reliable targeting
  originalText: string;  // plain-text selection shown to admin
  suggestedText: string;
  note: string;          // moderator's explanation
  authorId: string;
  authorEmail: string;
  status: SuggestionStatus;
  createdAt: number;
  reviewedAt?: number;
  reviewedBy?: string;
  // Image-specific fields
  imageAction?: ImageAction;
  tempImageUrl?: string;  // Firebase Storage download URL (pending approval)
  tempImagePath?: string; // Storage path for cleanup on reject/delete
  // Text/formula insert action
  textAction?: string;
  // Block delete — stores the deleted block's type for display
  blockType?: string;
}
