
const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

app.get('/', (req, res) => {
  res.send('OpenClaw Bot is running 24/7!');
});

// مسار استقبال رسائل تيليجرام
app.post('/webhook', (req, res) => {
  console.log('=== NEW TELEGRAM MESSAGE RECEIVED ===');
  console.log(JSON.stringify(req.body, null, 2));
  res.status(200).send('OK');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
