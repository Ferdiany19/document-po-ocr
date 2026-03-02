import { useState } from 'react'
import axios from 'axios'
import FileUpload from './components/FileUpload'
import ResultPreview from './components/ResultPreview'
import ProductDatabaseModal from './components/ProductDatabaseModal'
import API_BASE_URL from './config'
import './index.css'

function App() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [showDbModal, setShowDbModal] = useState(false)

  const handleFileUpload = async (selectedFile, ocrEngine = 'gemini', model = 'gemini-2.5-flash') => {
    setFile(selectedFile)
    setLoading(true)
    setError(null)
    setProgress({ percentage: 0, message: 'Connecting to server...' })

    // Setup SSE connection
    const eventSource = new EventSource(`${API_BASE_URL}/api/ocr/stream-progress`)
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        setProgress(data)
      } catch (e) {
        console.error('Error parsing SSE:', e)
      }
    }

    const formData = new FormData()
    formData.append('file', selectedFile)
    formData.append('ocrEngine', ocrEngine)
    formData.append('model', model)

    try {
      const response = await axios.post(`${API_BASE_URL}/api/ocr/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      setResult(response.data)
    } catch (err) {
      console.error('Upload error:', err)
      setError(err.response?.data?.error || 'Failed to process document. Please try again.')
    } finally {
      // Close SSE connection when request completes (success or fail)
      eventSource.close()
      setLoading(false)
      setProgress(null)
    }
  }

  const handleReset = () => {
    setFile(null)
    setResult(null)
    setError(null)
    setProgress(null)
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo-container">
          <div className="logo-icon">📝</div>
          <h1>Document PO OCR</h1>
        </div>
        <p className="subtitle">Automated PO to Excel Template Generator</p>
        <button
          className="btn-secondary mt-3"
          onClick={() => setShowDbModal(true)}
          style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <span>🗄️</span> Manage Master Database
        </button>
      </header>

      <main className="app-main">
        {!result && !loading && (
          <FileUpload onUpload={handleFileUpload} error={error} />
        )}

        {loading && (
          <div className="loading-state">
            <div className="spinner"></div>
            <h2>Processing Document</h2>
            {progress ? (
              <div className="progress-container">
                <p>{progress.message || 'Extracting data...'}</p>
                <div className="progress-bar-wrapper">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${progress.percentage || 0}%` }}
                  ></div>
                </div>
              </div>
            ) : (
              <p>Extracting data and generating template...</p>
            )}
          </div>
        )}

        {result && !loading && (
          <ResultPreview result={result} onReset={handleReset} />
        )}
      </main>

      <footer className="app-footer">
        <p>Document PO OCR. Made By Ferdian</p>
      </footer>

      {showDbModal && (
        <ProductDatabaseModal onClose={() => setShowDbModal(false)} />
      )}
    </div>
  )
}

export default App
