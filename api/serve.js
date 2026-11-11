const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  let reqPath = req.url === '/' ? 'index.html' : req.url.split('?')[0].replace(/^\//, '');
  if (!reqPath || reqPath === '') reqPath = 'index.html';

  let filePath = path.join(process.cwd(), reqPath);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, '..', reqPath);
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    let contentType = 'text/html; charset=utf-8';
    if (filePath.endsWith('.js')) contentType = 'application/javascript';
    if (filePath.endsWith('.css')) contentType = 'text/css';
    if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) contentType = 'image/jpeg';
    if (filePath.endsWith('.png')) contentType = 'image/png';
    res.setHeader('Content-Type', contentType);
    fs.createReadStream(filePath).pipe(res);
  } else {
    // 대체용 index.html(랜딩) 제공
    let indexPath = path.join(process.cwd(), 'index.html');
    if (fs.existsSync(indexPath)) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      fs.createReadStream(indexPath).pipe(res);
    } else {
      res.status(404).send('Not Found');
    }
  }
};

