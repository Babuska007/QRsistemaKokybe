const QRCode = require('qrcode');

const localIP = '10.240.9.118';
const port = 3000;

const devices = ["TEST001", "TEST002", "TEST003"];
const baseUrl = `http://${localIP}:${port}/scan?deviceId=`;

devices.forEach(device => {
  const url = baseUrl + device;
  QRCode.toFile(`${device}.png`, url, {
    color: { dark: "#000", light: "#fff" }
  }, (err) => {
    if (err) throw err;
    console.log(`QR for ${device} generated: ${url}`);
  });
});
