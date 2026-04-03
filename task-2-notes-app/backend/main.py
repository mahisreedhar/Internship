import sqlite3
from pathlib import Path

from fastapi import FastAPI, HTTPException, Path as PathParam, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "notes.db"


def get_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db() -> None:
    with get_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT NOT NULL
            )
            """
        )
        connection.commit()


class NoteBase(BaseModel):
    title: str = Field(..., min_length=1)
    content: str = Field(..., min_length=1)


class NoteCreate(NoteBase):
    pass


class NoteUpdate(NoteBase):
    pass


class NoteResponse(NoteBase):
    id: int


class DeleteResponse(BaseModel):
    message: str


init_db()


def normalize_note_fields(title: str, content: str) -> tuple[str, str]:
    clean_title = title.strip()
    clean_content = content.strip()

    if not clean_title or not clean_content:
        raise HTTPException(
            status_code=400,
            detail="Title and content cannot be empty.",
        )

    return clean_title, clean_content


@app.post("/notes", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
def create_note(note: NoteCreate):
    clean_title, clean_content = normalize_note_fields(note.title, note.content)

    with get_connection() as connection:
        cursor = connection.execute(
            "INSERT INTO notes (title, content) VALUES (?, ?)",
            (clean_title, clean_content),
        )
        connection.commit()
        note_id = cursor.lastrowid

        created_note = connection.execute(
            "SELECT id, title, content FROM notes WHERE id = ?",
            (note_id,),
        ).fetchone()

    return dict(created_note)


@app.get("/notes", response_model=list[NoteResponse])
def get_notes():
    with get_connection() as connection:
        rows = connection.execute("SELECT id, title, content FROM notes").fetchall()
    return [dict(row) for row in rows]


@app.put("/notes/{note_id}", response_model=NoteResponse)
def update_note(
    note: NoteUpdate,
    note_id: int = PathParam(..., ge=1),
):
    clean_title, clean_content = normalize_note_fields(note.title, note.content)

    with get_connection() as connection:
        cursor = connection.execute(
            "UPDATE notes SET title = ?, content = ? WHERE id = ?",
            (clean_title, clean_content, note_id),
        )
        connection.commit()

        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Note not found.")

        updated_note = connection.execute(
            "SELECT id, title, content FROM notes WHERE id = ?",
            (note_id,),
        ).fetchone()

    return dict(updated_note)


@app.delete("/notes/{note_id}", response_model=DeleteResponse)
def delete_note(note_id: int = PathParam(..., ge=1)):
    with get_connection() as connection:
        cursor = connection.execute("DELETE FROM notes WHERE id = ?", (note_id,))
        connection.commit()

        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Note not found.")

    return {"message": "Note deleted successfully."}
