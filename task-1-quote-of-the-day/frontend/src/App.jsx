import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [quote, setQuote] = useState(null)
  const [newQuoteText, setNewQuoteText] = useState('')
  const [newQuoteAuthor, setNewQuoteAuthor] = useState('')
  const [formMessage, setFormMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchQuote = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/quote')
      if (!response.ok) {
        throw new Error('Failed to fetch quote')
      }

      const data = await response.json()
      setQuote(data)
    } catch {
      setQuote({
        text: 'Could not load a quote. Please make sure the backend is running.',
        author: 'System',
      })
    }
  }

  useEffect(() => {
    fetchQuote()
  }, [])

  const handleAddQuote = async (event) => {
    event.preventDefault()

    const text = newQuoteText.trim()
    const author = newQuoteAuthor.trim()

    if (!text || !author) {
      setFormMessage('Please enter both quote text and author.')
      return
    }

    setIsSubmitting(true)
    setFormMessage('')

    try {
      const response = await fetch('http://127.0.0.1:8000/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, author }),
      })

      if (!response.ok) {
        throw new Error('Failed to add quote')
      }

      const data = await response.json()
      setQuote(data)
      setNewQuoteText('')
      setNewQuoteAuthor('')
      setFormMessage('Quote added successfully.')
    } catch {
      setFormMessage('Could not add quote. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="app">
      <div className="quote-layout">
        <h1 className="quote-title">Quote of the Day</h1>
        <section className="quote-card">
          <p className="quote-text">"{quote?.text ?? 'Loading quote...'}"</p>
          <p className="quote-author">- {quote?.author ?? 'Please wait'}</p>
          <button className="new-quote-btn" onClick={fetchQuote}>
            New Quote
          </button>

          <form className="add-quote-form" onSubmit={handleAddQuote}>
            <input
              className="quote-input"
              type="text"
              placeholder="Enter a new quote"
              value={newQuoteText}
              onChange={(event) => setNewQuoteText(event.target.value)}
            />
            <input
              className="quote-input"
              type="text"
              placeholder="Enter author name"
              value={newQuoteAuthor}
              onChange={(event) => setNewQuoteAuthor(event.target.value)}
            />
            <button className="add-quote-btn" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add Quote'}
            </button>
            {formMessage && <p className="form-message">{formMessage}</p>}
          </form>
        </section>
      </div>
    </main>
  )
}

export default App
