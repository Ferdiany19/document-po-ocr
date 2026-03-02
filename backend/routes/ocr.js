const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { parsePDF } = require('../services/pdfParser');
const { parseWithGemini } = require('../services/geminiParser');
const { generateExcel } = require('../services/excelGenerator');

const router = express.Router();

// Configure multer for PDF uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '..', 'uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}_${file.originalname}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'), false);
        }
    },
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB max
});

/**
 * POST /api/ocr/upload
 * Upload a PO PDF, extract data, generate Excel, return preview
 */
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        console.log(`📄 Processing: ${req.file.originalname}`);

        // Step 1: Parse the PDF
        const ocrEngine = req.body.ocrEngine || 'standard';
        const model = req.body.model || 'gemini-2.5-flash';
        const broadcastProgress = req.app.get('broadcastProgress');

        console.log(`🧠 Using OCR Engine: ${ocrEngine}, Model: ${model}`);

        let poData;
        if (ocrEngine === 'gemini') {
            if (broadcastProgress) broadcastProgress('start', 10, 'Initializing Gemini AI Parser...');
            poData = await parseWithGemini(req.file.path, model, broadcastProgress);
        } else {
            if (broadcastProgress) broadcastProgress('parsing', 50, 'Parsing PDF with standard engine...');
            poData = await parsePDF(req.file.path);
        }

        if (broadcastProgress) broadcastProgress('generating', 95, 'Generating Excel template...');
        console.log(`✅ Extracted ${poData.items.length} items from PDF`);

        // Step 2: Generate Excel
        const outputId = uuidv4();
        const outputFileName = `SO_${poData.poNo || 'output'}_${outputId.substring(0, 8)}.xlsx`;
        const outputPath = path.join(__dirname, '..', 'output', outputFileName);

        const preview = await generateExcel(poData, outputPath);
        console.log(`✅ Excel generated: ${outputFileName}`);

        if (broadcastProgress) broadcastProgress('done', 100, 'Processing complete!');

        // Add token usage to preview if available
        if (poData.tokenUsage) {
            preview.tokenUsage = poData.tokenUsage;
        }

        // Step 3: Return preview + download ID
        res.json({
            success: true,
            downloadId: outputFileName,
            preview
        });

    } catch (error) {
        console.error('❌ OCR Error:', error);
        res.status(500).json({
            error: 'Failed to process PDF',
            detail: error.message
        });
    } finally {
        // Auto-delete the uploaded PDF file to save space
        if (req.file && req.file.path) {
            try {
                if (fs.existsSync(req.file.path)) {
                    fs.unlinkSync(req.file.path);
                    console.log(`🗑️ Deleted temp file: ${req.file.filename}`);
                }
            } catch (cleanupErr) {
                console.error('Failed to clean up uploaded file:', cleanupErr);
            }
        }
    }
});

/**
 * GET /api/ocr/download/:id
 * Download the generated Excel file
 */
router.get('/download/:id', (req, res) => {
    const filePath = path.join(__dirname, '..', 'output', req.params.id);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    res.download(filePath, req.params.id, (err) => {
        if (err) {
            console.error('Download error:', err);
            res.status(500).json({ error: 'Download failed' });
        }
    });
});

module.exports = router;
