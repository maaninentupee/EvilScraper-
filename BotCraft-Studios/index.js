const express = require('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('Tervetuloa BotCraft Studios palvelimelle!');
});

app.listen(port, () => {
  console.log(`Palvelin käynnissä portissa ${port}`);
});
