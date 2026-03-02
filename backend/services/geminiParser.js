const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');

/**
 * Parse PO PDF document using Gemini AI to extract structured data
 * @param {string} filePath - Path to PDF file
 * @returns {Object} Extracted PO data in the required format
 */
async function parseWithGemini(filePath, model = 'gemini-2.5-flash', onProgress = null) {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not set in environment variables');
    }

    // Initialize the Gemini client
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    try {
        if (onProgress) onProgress('uploading', 25, 'Uploading document to Gemini...');
        // Upload the file first
        const uploadResult = await ai.files.upload({
            file: filePath,
            mimeType: 'application/pdf',
            displayName: 'PO Document'
        });

        if (onProgress) onProgress('analyzing', 50, 'Analyzing document using ' + model + '...');
        // Construct the prompt for Gemini
        const prompt = `
            You are a highly accurate data extraction system. Extract the Purchase Order data from this document and return it purely as a JSON object.
            
            Focus on extracting these specific fields perfectly:
            - PO No
            - PO Date
            - Remarks
            - And for each item in the table: Part Name, Quantity, Price, and Amount.

            CRITICAL ACCURACY WARNING FOR PART NAME:
            You must extract the Part Name string EXACTLY as printed on the document. Do not hallucinate, guess, or autocorrect.
            Common OCR errors you MUST avoid:
            - Confusing 'H' with 'C' (e.g., misreading 'SPH590' as 'SPC590').
            - Confusing numbers (e.g., misreading '296' as '292', or '590' as '560').
            Read the Part Name character by character.
            
            Return ONLY a valid JSON object with the exact structure below:
            {
                "poNo": "Extract the PO number strictly without prefixes like 'PO No:'",
                "poDate": "Extract the PO Date",
                "remarks": "Extract any remarks or notes found in the document",
                "items": [
                    {
                        "partName": "The EXACT Part Name extracted character-by-character. DANGER: Double-check for 'SPH' vs 'SPC' and verify all numbers are correct.",
                        "quantity": number (Extract the total Quantity for this item. Ensure it is a number),
                        "price": number (Extract the Unit Price. Ensure it is a number),
                        "amount": number (Extract the Amount or Total Price for this item. Ensure it is a number)
                    }
                ]
            }

            IMPORTANT RULES:
            - Provide ONLY the JSON. No Markdown formatting, no \`\`\`json blocks.
            - Ensure numerical values like quantity, price, and amount are parsed as numbers (e.g., 1000.50), do not include commas.
            - If a field is not found, use an empty string "" or 0 for numbers.
        `;

        // Generate content
        const response = await ai.models.generateContent({
            model: model,
            contents: [
                {
                    role: 'user',
                    parts: [
                        { fileData: { fileUri: uploadResult.uri, mimeType: uploadResult.mimeType } },
                        { text: prompt }
                    ]
                }
            ],
            config: {
                temperature: 0.1,
            }
        });

        if (onProgress) onProgress('cleanup', 75, 'Cleaning up temporary files...');
        // Clean up the uploaded file to avoid clutter
        try {
            await ai.files.delete({ name: uploadResult.name });
        } catch (cleanupError) {
            console.error('Failed to cleanup file from Gemini:', cleanupError);
        }

        if (onProgress) onProgress('parsing', 90, 'Parsing output...');
        // Parse the response
        let textResponse = response.text;

        let tokenUsage = null;
        if (response.usageMetadata) {
            tokenUsage = {
                promptTokens: response.usageMetadata.promptTokenCount,
                candidatesTokens: response.usageMetadata.candidatesTokenCount,
                totalTokens: response.usageMetadata.totalTokenCount
            };
        }

        // Remove markdown formatting if Gemini included it despite instructions
        if (textResponse.startsWith('```json')) {
            textResponse = textResponse.replace(/```json\n|\n```/g, '');
        } else if (textResponse.startsWith('```')) {
            textResponse = textResponse.replace(/```\n|\n```/g, '');
        }

        const data = JSON.parse(textResponse.trim());

        return {
            ...data,
            totalItems: data.items ? data.items.length : 0,
            tokenUsage
        };

    } catch (error) {
        console.error('Gemini AI Parser error:', error);
        throw new Error(`Failed to parse document with Gemini: ${error.message}`);
    }
}

module.exports = { parseWithGemini };
