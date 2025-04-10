// backend/server.js

require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const multer = require('multer');
const mammoth = require('mammoth');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors');
const nodemailer = require('nodemailer'); // Add nodemailer

const app = express();
const port = 3000; // Or any other port you prefer

// --- Configuration ---

// CORS: Allow requests from your frontend origin
// In development, allowing all origins might be okay, but be more specific in production.
app.use(cors());

// Middleware to parse JSON bodies (for text input)
app.use(express.json());

// Multer setup for handling file uploads in memory
const storage = multer.memoryStorage(); // Store file in memory buffer
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // Limit file size (e.g., 10MB)
});

// Google AI Setup
if (!process.env.GEMINI_API_KEY) {
    console.error("ERROR: GEMINI_API_KEY is not set in the .env file.");
    process.exit(1); // Exit if API key is missing
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro-preview-03-25" }); // Use specific preview model name

// Nodemailer Setup (using environment variables)
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST, // e.g., 'smtp.gmail.com'
    port: process.env.EMAIL_PORT || 587, // Often 587 for TLS, 465 for SSL
    secure: (process.env.EMAIL_PORT === '465'), // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER, // Your email address
        pass: process.env.EMAIL_PASS, // Your email password or App Password
    },
});

// Verify transporter configuration (optional, good for debugging)
transporter.verify(function (error, success) {
    if (error) {
        console.error("Nodemailer configuration error:", error);
    } else {
        console.log("Nodemailer is ready to send emails");
    }
});

// --- API Endpoint ---

// POST /api/parse-email-ai
// Handles both JSON text and file uploads
app.post('/api/parse-email-ai', upload.single('feedbackFile'), async (req, res) => {
    console.log("Received request on /api/parse-email-ai");
    let inputText = '';

    try {
        // --- 1. Extract Text ---
        if (req.file) {
            // File upload case
            console.log("Processing uploaded file:", req.file.originalname);
            if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || req.file.originalname.endsWith('.docx')) {
                // Extract text from DOCX using mammoth
                const result = await mammoth.extractRawText({ buffer: req.file.buffer });
                inputText = result.value;
                console.log("Extracted text from docx.");
            } else if (req.file.mimetype === 'text/plain' || req.file.originalname.endsWith('.txt')) {
                // Read text from TXT file buffer
                inputText = req.file.buffer.toString('utf8');
                console.log("Read text from txt.");
            } else {
                // Added check for file existence before throwing unsupported type
                throw new Error('Unsupported file type uploaded. Please use .txt or .docx.');
            }
        } else if (req.body && req.body.emailText) {
            // JSON text input case
            console.log("Processing text from JSON body.");
            inputText = req.body.emailText;
        } else {
             // If file exists but wasn't processed (e.g., wrong type handled above), or no text body
             if (req.file) {
                 // This case might be redundant due to the check above, but good for clarity
                 throw new Error('Unsupported file type uploaded. Please use .txt or .docx.');
             } else {
                throw new Error('No input text or supported file provided.');
             }
        }


        if (!inputText || !inputText.trim()) {
             throw new Error('Input text is empty after extraction or not provided.');
        }

        // --- 2. Call Gemini API ---
        console.log("Sending text to Gemini...");
        const prompt = `Extract all actionable to-do list items or feedback points from the following text. Focus on specific actions or requests. Return the result ONLY as a JSON array of strings, where each string is a single task. Do not include any introductory text or explanations, just the JSON array. Text:\n\n"${inputText}"`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let aiText = response.text();
        console.log("Received response from Gemini.");

        // --- 3. Parse Gemini Response ---
        // Clean the response to get only the JSON array part
        aiText = aiText.trim();
        // More robust regex to find JSON array, handling potential markdown backticks
        const jsonMatch = aiText.match(/```json\s*(\[.*\])\s*```|(\[.*\])/s);
        if (!jsonMatch || !(jsonMatch[1] || jsonMatch[2])) {
             console.error("Gemini response did not contain a valid JSON array:", aiText);
             throw new Error("AI response format was invalid. Could not find JSON array.");
        }
        // Use the captured group that matched (either inside backticks or standalone)
        aiText = jsonMatch[1] || jsonMatch[2];

        let tasks = [];
        try {
            tasks = JSON.parse(aiText);
            if (!Array.isArray(tasks) || !tasks.every(item => typeof item === 'string')) {
                 console.error("Parsed JSON is not an array of strings:", tasks);
                 throw new Error("AI response was not an array of strings.");
            }
             console.log("Successfully parsed tasks from AI response:", tasks);
        } catch (parseError) {
            console.error("Failed to parse Gemini JSON response:", parseError, "\nRaw AI Text (extracted):", aiText);
            throw new Error("Failed to parse AI response.");
        }


        // --- 4. Send Response to Frontend ---
        res.status(200).json({ tasks: tasks });

    } catch (error) {
        console.error("Error in /api/parse-email-ai:", error);
        res.status(500).json({ message: error.message || "An internal server error occurred." });
    }
});

// POST /api/send-summary
// Handles sending the compiled email summary
app.post('/api/send-summary', async (req, res) => {
    console.log("Received request on /api/send-summary");
    // Expecting { summaryText: "...", recipientEmail: "..." }
    const { summaryText, recipientEmail } = req.body;

    if (!summaryText) {
        return res.status(400).json({ message: "Missing summaryText in request body." });
    }
    if (!recipientEmail) {
        return res.status(400).json({ message: "Missing recipientEmail in request body." });
    }
    // Basic email validation on backend too (optional but good practice)
    if (!/^\S+@\S+\.\S+$/.test(recipientEmail)) {
         return res.status(400).json({ message: "Invalid recipient email format provided." });
    }
     if (!process.env.EMAIL_USER) {
         console.error("ERROR: EMAIL_USER is not set in the .env file.");
         return res.status(500).json({ message: "Server configuration error: Sender email missing." });
    }


    const mailOptions = {
        from: `"To-Do App" <${process.env.EMAIL_USER}>`, // Sender address (use configured user)
        to: recipientEmail, // Use recipient from request body
        subject: 'Your To-Do List Summary', // Subject line
        text: summaryText, // Plain text body from the request
        // html: "<b>Hello world?</b>", // You could send HTML instead/as well
    };

    try {
        console.log("Attempting to send email summary...");
        let info = await transporter.sendMail(mailOptions);
        console.log('Email sent: %s', info.messageId);
        res.status(200).json({ message: "Email summary sent successfully!" });
    } catch (error) {
        console.error("Error sending email:", error);
        res.status(500).json({ message: "Failed to send email summary." });
    }
});

// --- Start Server ---
app.listen(port, () => {
    console.log(`Backend server listening at http://localhost:${port}`);
});