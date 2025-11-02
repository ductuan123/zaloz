import express from 'express';
import bodyParser from 'body-parser';

const app = express();
app.use(bodyParser.json());

app.post('/', (req, res) => {
  console.log('Nhận webhook từ Zalo:', req.body);
  res.status(200).send('OK');
});

export default app;
