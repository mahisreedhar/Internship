import random

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

quotes = [
    {
        "text": "Success is the sum of small efforts, repeated day in and day out.",
        "author": "Robert Collier",
    },
    {
        "text": "It always seems impossible until it is done.",
        "author": "Nelson Mandela",
    },
    {
        "text": "The future depends on what you do today.",
        "author": "Mahatma Gandhi",
    },
    {
        "text": "Believe you can and you are halfway there.",
        "author": "Theodore Roosevelt",
    },
    {
        "text": "Discipline is choosing between what you want now and what you want most.",
        "author": "Abraham Lincoln",
    },
    {
        "text": "Do not wait. The time will never be just right.",
        "author": "Napoleon Hill",
    },
]


class Quote(BaseModel):
    text: str
    author: str


@app.get("/quote")
def get_quote():
    return random.choice(quotes)


@app.post("/quote", status_code=201)
def add_quote(quote: Quote):
    text = quote.text.strip()
    author = quote.author.strip()

    if not text or not author:
        raise HTTPException(status_code=400, detail="Text and author are required.")

    new_quote = {"text": text, "author": author}
    quotes.append(new_quote)
    return new_quote
