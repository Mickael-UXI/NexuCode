import { Router } from 'express';
import AdmZip from 'adm-zip';

export const zipRouter = Router();

interface FileInput {
  path: string;
  content: string;
}

zipRouter.post('/files/zip', (req, res) => {
  const { files, projectName = 'nexus-project' } = req.body as { files: FileInput[]; projectName?: string };
  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: 'Envie ao menos um arquivo em "files".' });
  }

  const zip = new AdmZip();
  for (const file of files) {
    zip.addFile(file.path, Buffer.from(file.content, 'utf-8'));
  }

  const buffer = zip.toBuffer();
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${projectName}.zip"`);
  res.send(buffer);
});
