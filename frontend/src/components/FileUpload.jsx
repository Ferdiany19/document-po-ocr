import { useState, useRef } from 'react';

const FileUpload = ({ onUpload, error }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [ocrEngine, setOcrEngine] = useState('gemini');
    const [geminiModel, setGeminiModel] = useState('gemini-2.5-flash');
    const fileInputRef = useRef(null);

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            validateAndUpload(file);
        }
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            validateAndUpload(e.target.files[0]);
        }
    };

    const validateAndUpload = (file) => {
        if (file.type !== 'application/pdf') {
            alert('Hanya file PDF yang diperbolehkan!');
            return;
        }

        // Check file size (max 50MB)
        if (file.size > 50 * 1024 * 1024) {
            alert('Ukuran file terlalu besar. Maksimal 50MB.');
            return;
        }

        onUpload(file, ocrEngine, geminiModel);
    };

    return (
        <div className="upload-container">
            <div className="engine-selector mb-4">
                <p className="engine-label">Pilih Engine OCR:</p>
                <div className="engine-options">
                    <label className={`engine-option ${ocrEngine === 'gemini' ? 'active' : ''}`}>
                        <input
                            type="radio"
                            name="ocrEngine"
                            value="gemini"
                            checked={ocrEngine === 'gemini'}
                            onChange={() => setOcrEngine('gemini')}
                        />
                        <span className="engine-icon">✨</span>
                        Gemini AI (Recommended)
                    </label>
                    <label className={`engine-option ${ocrEngine === 'standard' ? 'active' : ''}`}>
                        <input
                            type="radio"
                            name="ocrEngine"
                            value="standard"
                            checked={ocrEngine === 'standard'}
                            onChange={() => setOcrEngine('standard')}
                        />
                        <span className="engine-icon">⚙️</span>
                        Standard
                    </label>
                </div>

                {ocrEngine === 'gemini' && (
                    <div className="model-selector">
                        <label htmlFor="gemini-model" className="model-label">Gemini Model:</label>
                        <select
                            id="gemini-model"
                            className="input-select"
                            value={geminiModel}
                            onChange={(e) => setGeminiModel(e.target.value)}
                        >
                            <option value="gemini-2.5-flash">Gemini 2.5 Flash (Free Tier - Fast & Accurate)</option>
                            <option value="gemini-1.5-flash">Gemini 1.5 Flash (Free Tier)</option>
                            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                        </select>
                    </div>
                )}
            </div>

            <div
                className={`drop-zone ${isDragging ? 'dragging' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current.click()}
            >
                <div className="upload-icon">📄</div>
                <h2>Upload PO Document</h2>
                <p>Tarik & lepas file PDF ke sini, atau klik untuk memilih file</p>
                <span className="file-hint">Hanya format .pdf (Maks 50MB)</span>

                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="application/pdf"
                    className="hidden-input"
                />

                <button className="btn-upload">Pilih File</button>
            </div>

            {error && (
                <div className="error-message">
                    <span className="error-icon">⚠️</span>
                    {error}
                </div>
            )}
        </div>
    );
};

export default FileUpload;
