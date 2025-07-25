// const multer = require('multer');
// const multerS3 = require('multer-s3');
// const path = require('path');
// const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');

// // Create S3 client
// const s3Client = new S3Client({
//   region: process.env.AWS_REGION || 'us-east-1',
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
//   }
// });

// // Helper function to create upload config
// const createUploadConfig = (folder) => ({
//   s3: s3Client,
//   bucket: process.env.AWS_S3_BUCKET || 'cravecrafted-banners', // Provide a default bucket name
//   acl: 'public-read',
//   metadata: (req, file, cb) => {
//     cb(null, { fieldName: file.fieldname });
//   },
//   key: (req, file, cb) => {
//     const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//     cb(null, `${folder}/${uniqueSuffix}-${file.originalname}`);
//   }
// });

// // Configure multer for Banner uploads
// const bannerUpload = multer({
//   storage: multerS3({
//     s3: s3Client,
//     bucket: process.env.AWS_S3_BUCKET || 'cravecrafted-banners',
//     acl: 'public-read',
//     metadata: (req, file, cb) => {
//       cb(null, { fieldName: file.fieldname });
//     },
//     key: (req, file, cb) => {
//       const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//       cb(null, `banners/${uniqueSuffix}-${file.originalname}`);
//     }
//   }),
//   fileFilter: (req, file, cb) => {
//     const filetypes = /jpeg|jpg|png|gif|webp/;
//     const mimetype = filetypes.test(file.mimetype);
//     const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

//     if (mimetype && extname) {
//       return cb(null, true);
//     }

//     cb(new Error('Only image files are allowed (JPEG, JPG, PNG, GIF, WEBP)'));
//   },
//   limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
// });

// // Function to delete object from S3
// const deleteS3Object = async (key) => {
//   try {
//     const command = new DeleteObjectCommand({
//       Bucket: process.env.AWS_S3_BUCKET || 'cravecrafted-banners',
//       Key: key
//     });
//     await s3Client.send(command);
//     return true;
//   } catch (error) {
//     console.error('Error deleting from S3:', error);
//     return false;
//   }
// };

// module.exports = {
//   s3Client,
//   deleteS3Object,
//   bannerUpload
// };
