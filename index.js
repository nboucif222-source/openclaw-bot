const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.send('OpenClaw Bot is running 24/7!');
});

app.post('/webhook', (req, res) => {
  console.log('Received payload:', req.body);
  res.status(200).send('OK');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
