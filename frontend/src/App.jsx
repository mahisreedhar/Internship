import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [quote, setQuote] = useState(null)

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
        </section>
      </div>
    </main>
  )
}

export default App
