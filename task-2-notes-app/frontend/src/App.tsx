import { FormEvent, useEffect, useState } from 'react'
import './App.css'

const API_BASE_URL = 'http://127.0.0.1:8000'

interface Note {
  id: number
  title: string
  content: string
}

interface DeleteResponse {
  message: string
}

const pastelPalette: string[] = [
  '#d9f8cc',
  '#ffd8ba',
  '#e5dcff',
  '#cfefff',
  '#d6ffe8',
  '#ffd5e5',
  '#e0f0c9',
]

const noteTimePlaceholder = 'Last edited: --:--'

function getNoteColor(noteId: number): string {
  return pastelPalette[noteId % pastelPalette.length]
}

function isNote(value: unknown): value is Note {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Record<string, unknown>

  return (
    typeof candidate.id === 'number' &&
    typeof candidate.title === 'string' &&
    typeof candidate.content === 'string'
  )
}

function isNoteArray(value: unknown): value is Note[] {
  return Array.isArray(value) && value.every(isNote)
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, options)

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'Request failed.')
  }

  return (await response.json()) as T
}

function App() {
  const [notes, setNotes] = useState<Note[]>([])
  const [title, setTitle] = useState<string>('')
  const [content, setContent] = useState<string>('')
  const [editingCardId, setEditingCardId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState<string>('')
  const [editContent, setEditContent] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchNotes(): Promise<void> {
    const data = await apiRequest<unknown>('/notes')
    if (!isNoteArray(data)) {
      throw new Error('Unexpected notes response format.')
    }
    setNotes(data)
  }

  async function createNote(payload: { title: string; content: string }): Promise<Note> {
    const data = await apiRequest<unknown>('/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!isNote(data)) {
      throw new Error('Unexpected create response format.')
    }

    return data
  }

  async function updateNote(
    noteId: number,
    payload: { title: string; content: string },
  ): Promise<Note> {
    const data = await apiRequest<unknown>(`/notes/${noteId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!isNote(data)) {
      throw new Error('Unexpected update response format.')
    }

    return data
  }

  async function deleteNote(noteId: number): Promise<DeleteResponse> {
    const data = await apiRequest<unknown>(`/notes/${noteId}`, {
      method: 'DELETE',
    })

    if (
      typeof data !== 'object' ||
      data === null ||
      typeof (data as DeleteResponse).message !== 'string'
    ) {
      throw new Error('Unexpected delete response format.')
    }

    return data as DeleteResponse
  }

  function resetForm(): void {
    setTitle('')
    setContent('')
  }

  function beginCardEdit(note: Note): void {
    setEditingCardId(note.id)
    setEditTitle(note.title)
    setEditContent(note.content)
  }

  function cancelCardEdit(): void {
    setEditingCardId(null)
    setEditTitle('')
    setEditContent('')
  }

  async function saveCardEdit(noteId: number): Promise<void> {
    const cleanTitle = editTitle.trim()
    const cleanContent = editContent.trim()

    if (!cleanTitle || !cleanContent) {
      setError('Please provide both title and content.')
      return
    }

    try {
      setError(null)
      const updatedNote = await updateNote(noteId, {
        title: cleanTitle,
        content: cleanContent,
      })

      setNotes((currentNotes) =>
        currentNotes.map((note) => (note.id === noteId ? updatedNote : note)),
      )
      cancelCardEdit()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update note.')
    }
  }

  useEffect(() => {
    async function loadInitialNotes(): Promise<void> {
      try {
        setError(null)
        await fetchNotes()
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Failed to load notes.')
      } finally {
        setIsLoading(false)
      }
    }

    void loadInitialNotes()
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()

    const cleanTitle = title.trim()
    const cleanContent = content.trim()

    if (!cleanTitle || !cleanContent) {
      setError('Please provide both title and content.')
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)

      const createdNote = await createNote({ title: cleanTitle, content: cleanContent })
      setNotes((currentNotes) => [createdNote, ...currentNotes])

      resetForm()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save note.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(noteId: number): Promise<void> {
    const shouldDelete = window.confirm('Delete this note?')
    if (!shouldDelete) {
      return
    }

    try {
      setError(null)
      await deleteNote(noteId)
      setNotes((currentNotes) => currentNotes.filter((note) => note.id !== noteId))

      if (editingCardId === noteId) {
        cancelCardEdit()
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to delete note.')
    }
  }

  return (
    <main className="dashboard">
      <section className="note-form-shell">
        <div className="tape tape-left" aria-hidden="true" />
        <div className="tape tape-right" aria-hidden="true" />
        <h1>NOTES APP</h1>
        <p className="subtitle">Create a Note</p>

        <form className="note-form" onSubmit={handleSubmit}>
          <label className="field-group">
            <span>Title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Write a short note title..."
              maxLength={120}
              required
            />
          </label>

          <label className="field-group">
            <span>Content</span>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Capture your thoughts, tasks, or reminders..."
              maxLength={1200}
              required
            />
          </label>

          <div className="form-actions">
            <button className="primary-action" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Add Note'}
            </button>
          </div>
        </form>
      </section>

      {error && <p className="status-message error">{error}</p>}
      {isLoading && <p className="status-message">Loading notes...</p>}
      {!isLoading && notes.length === 0 && (
        <p className="status-message">No notes yet. Add your first sticky note above.</p>
      )}

      <section className="notes-grid" aria-live="polite">
        {notes.map((note) => (
          <article
            key={note.id}
            className="note-card"
            style={{ backgroundColor: getNoteColor(note.id) }}
          >
            {editingCardId === note.id ? (
              <>
                <input
                  className="card-edit-input"
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                  maxLength={120}
                />
                <textarea
                  className="card-edit-textarea"
                  value={editContent}
                  onChange={(event) => setEditContent(event.target.value)}
                  maxLength={1200}
                />
              </>
            ) : (
              <>
                <h2>{note.title}</h2>
                <p className="note-content">{note.content}</p>
              </>
            )}

            <footer className="note-footer">
              <p className="note-time">{noteTimePlaceholder}</p>
              <div className="card-actions">
                {editingCardId === note.id ? (
                  <>
                    <button type="button" onClick={() => void saveCardEdit(note.id)}>
                      Save
                    </button>
                    <button type="button" onClick={cancelCardEdit}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => beginCardEdit(note)}>
                    Edit
                  </button>
                )}
                <button type="button" onClick={() => void handleDelete(note.id)}>
                  Delete
                </button>
              </div>
            </footer>
          </article>
        ))}
      </section>
    </main>
  )
}

export default App
