import { Router } from "express";
import { getAllFiles, uploadFile } from "../actions/file.js";
import multer from "multer";

export default function fileRoute() {
    const router = Router();
    const upload = multer();

    router.post('', upload.single('input'), (req, res, next) => {
        console.log('File upload request received:', {
            file: req.file,
            body: req.body,
            contentType: req.headers['content-type']
        });
        return uploadFile(req, res, next);
    });
    router.get('', getAllFiles);

    return router;
}