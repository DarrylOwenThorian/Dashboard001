import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { Sequelize, DataTypes, Op } from 'sequelize';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// -----------------------------------------------------------------------------
// 1. DATABASE CONFIGURATION (PostgreSQL via Sequelize)
// -----------------------------------------------------------------------------

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: false,
  }
);

// Enable Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    // Allow any *.pages.dev domain or localhost
    if (origin.endsWith('.pages.dev') || origin.includes('localhost')) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.options('*', cors());

app.use(express.json());

// Define ImageFile Model
const ImageFile = sequelize.define('ImageFile', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  filename: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  file_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  file_path: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'image_files',
  timestamps: false, // Since created_at is handled manually/by default
});

// Helper function to format model instance to match Flask's to_dict() output
const formatImageDict = (image) => {
  const createdAtFormatted = image.created_at
    ? new Date(image.created_at).toISOString().replace('T', ' ').substring(0, 19)
    : null;

  return {
    id: image.id,
    filename: image.filename,
    file_type: image.file_type,
    file_path: image.file_path,
    url: `/uploads/${image.filename}`, // Changed from http://localhost:5000/uploads/...
    created_at: createdAtFormatted,
  };
};

// Sync models with PostgreSQL
sequelize.sync().then(() => {
  console.log('PostgreSQL Database Connected & Models Synced');
}).catch((err) => {
  console.error('Database connection error:', err);
});

// -----------------------------------------------------------------------------
// 2. UPLOAD & STATIC FILE CONFIGURATION
// -----------------------------------------------------------------------------
const UPLOAD_FOLDER = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_FOLDER)) {
  fs.mkdirSync(UPLOAD_FOLDER, { recursive: true });
}

// Serve uploaded static files directly
app.use('/uploads', express.static(UPLOAD_FOLDER));

// Multer Storage Engine configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_FOLDER);
  },
  filename: (req, file, cb) => {
    const originalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniquePrefix = crypto.randomBytes(4).toString('hex'); // Matches uuid.hex[:8]
    const uniqueFilename = `${uniquePrefix}_${originalName}`;
    cb(null, uniqueFilename);
  },
});

// Allowed file extensions filter
const fileFilter = (req, file, cb) => {
  const allowedExtensions = /\.(png|jpg|jpeg|webp|gif)$/i;
  if (file.originalname.match(allowedExtensions)) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
});

// -----------------------------------------------------------------------------
// 3. API ROUTES
// -----------------------------------------------------------------------------

// Endpoint 1: General Stats
app.get('/api/stats', (req, res) => {
  res.json({
    totalProducts: 1248,
    productPages: 24,
    contacts: 842,
  });
});

// Endpoint 2: PostgreSQL Image Stats
app.get('/api/images/stats', async (req, res) => {
  try {
    const imageRecords = await ImageFile.findAll({
      where: {
        file_type: {
          [Op.in]: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
        },
      },
      order: [['created_at', 'DESC']],
    });

    const totalCount = imageRecords.length;
    const latestImage = totalCount > 0 ? formatImageDict(imageRecords[0]) : null;

    res.json({
      totalImages: totalCount,
      latestImage,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT Endpoint: Update an existing image record by ID
app.put('/api/images/:image_id', async (req, res) => {
  try {
    const imageId = req.params.image_id;
    const image = await ImageFile.findByPk(imageId);

    if (!image) {
      return res.status(404).json({ error: 'Image record not found' });
    }

    const { filename, file_type, file_path } = req.body;

    if (filename !== undefined) image.filename = filename;
    if (file_type !== undefined) image.file_type = file_type;
    if (file_path !== undefined) image.file_path = file_path;

    await image.save();

    res.status(200).json({
      message: 'Record updated successfully',
      image: formatImageDict(image),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST Endpoint: Handle multipart file upload
app.post('/api/upload', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file selected or uploaded' });
    }

    try {
      const newImage = await ImageFile.create({
        filename: req.file.filename,
        file_type: req.file.mimetype || 'image/png',
        file_path: req.file.path,
      });

      res.status(201).json({
        message: 'File uploaded successfully',
        image: formatImageDict(newImage),
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});

// GET Endpoint: Fetch all uploaded images
app.get('/api/images/all', async (req, res) => {
  try {
    const images = await ImageFile.findAll({
      order: [['created_at', 'DESC']],
    });

    const formattedImages = images.map((img) => formatImageDict(img));
    res.status(200).json(formattedImages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE Endpoint: Delete an image record and physical file
app.delete('/api/images/:image_id', async (req, res) => {
  try {
    const imageId = req.params.image_id;
    const image = await ImageFile.findByPk(imageId);

    if (!image) {
      return res.status(404).json({ error: 'Image record not found' });
    }

    // Delete physical file from disk if it exists
    if (fs.existsSync(image.file_path)) {
      fs.unlinkSync(image.file_path);
    }

    // Delete record from PostgreSQL
    await image.destroy();

    res.status(200).json({ message: `Image #${imageId} deleted successfully` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Optional: Fallback for serving React production build
// app.use(express.static(path.join(__dirname, 'client/dist')));
// app.get('*', (req, res) => {
//   res.sendFile(path.join(__dirname, 'client/dist', 'index.html'));
// });

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));