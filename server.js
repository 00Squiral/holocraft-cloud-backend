/**
 * HoloCraft Cloud Backend Server
 * Handles .mcstructure file uploads, unique ID assignment, and public community queries.
 */

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for web studio access
app.use(cors());
app.use(express.json());

// Ensure storage directory exists
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// In-memory metadata store (Can be upgraded to MongoDB / PostgreSQL)
let structureRegistry = [
    {
        id: 'hub_spawn_01',
        name: 'spawn_hub.mcstructure',
        size: '24.5 KB',
        author: 'System Admin',
        downloads: 12,
        filename: 'spawn_hub.mcstructure',
        createdAt: new Date().toISOString()
    }
];

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const cleanName = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
        cb(null, `${uniqueSuffix}-${cleanName}`);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit per structure
});

// --- API ENDPOINTS ---

// 1. Health check
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'HoloCraft Cloud API',
        totalStructures: structureRegistry.length
    });
});

// 2. Get all public structures
app.get('/api/structures', (req, res) => {
    res.json({
        success: true,
        count: structureRegistry.length,
        structures: structureRegistry
    });
});

// 3. Upload a new .mcstructure file
app.post('/api/upload', upload.single('structure'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No structure file provided.' });
        }

        const originalName = req.file.originalname;
        const baseName = originalName.replace(/\.[^/.]+$/, "").toLowerCase().replace(/[^a-z0-9_]/g, '_');
        const assignedId = baseName + '_' + Math.random().toString(36).substring(2, 6);
        const fileSizeKB = (req.file.size / 1024).toFixed(1) + ' KB';
        const authorName = req.body.author || 'Anonymous Builder';

        const newRecord = {
            id: assignedId,
            name: originalName,
            size: fileSizeKB,
            author: authorName,
            downloads: 0,
            filename: req.file.filename,
            createdAt: new Date().toISOString()
        };

        structureRegistry.unshift(newRecord);

        res.status(201).json({
            success: true,
            message: 'Structure uploaded and assigned ID successfully!',
            structure: newRecord
        });
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ success: false, error: 'Internal server error during upload.' });
    }
});

// 4. Download specific structure file binary
app.get('/api/download/:id', (req, res) => {
    const record = structureRegistry.find(s => s.id === req.params.id);
    if (!record) {
        return res.status(404).json({ success: false, error: 'Structure ID not found.' });
    }

    const filePath = path.join(UPLOAD_DIR, record.filename);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, error: 'File missing from server storage.' });
    }

    record.downloads += 1;
    res.download(filePath, record.name);
});

// Start server
app.listen(PORT, () => {
    console.log(`HoloCraft Cloud backend running on port ${PORT}`);
});