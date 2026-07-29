/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const missing = ['q2-clean','q2-eclectic','q3-athleisure','q3-linen','q3-smart','q3-denim','q4-mono','q4-earth','q4-navy','q4-neon','q5-tailored','q5-graphic','q5-raw','q5-embroidery'];
const gradients = {
  'q2-clean':['#f8f9fa','#e9ecef'],
  'q2-eclectic':['#ff6b6b','#ffd93d'],
  'q3-athleisure':['#495057','#adb5bd'],
  'q3-linen':['#d4a574','#f0e6d3'],
  'q3-smart':['#2c3e50','#3498db'],
  'q3-denim':['#1a5276','#5dade2'],
  'q4-mono':['#1a1a1a','#e0e0e0'],
  'q4-earth':['#8b4513','#6b8e23'],
  'q4-navy':['#1a2a4a','#722f37'],
  'q4-neon':['#ff00ff','#00ff88'],
  'q5-tailored':['#2c3e50','#95a5a6'],
  'q5-graphic':['#e74c3c','#f39c12'],
  'q5-raw':['#1a1a1a','#4a4a4a'],
  'q5-embroidery':['#8e44ad','#d4a574'],
};
missing.forEach(name => {
  const [c1, c2] = gradients[name];
  const svg = [
    "<svg xmlns='http://www.w3.org/2000/svg' width='400' height='500' viewBox='0 0 400 500'>",
    "<defs><linearGradient id='g' x1='0%' y1='0%' x2='100%' y2='100%'>",
    "<stop offset='0%' stop-color='" + c1 + "'/>",
    "<stop offset='100%' stop-color='" + c2 + "'/>",
    "</linearGradient></defs>",
    "<rect width='400' height='500' fill='url(#g)'/>",
    "</svg>"
  ].join('');
  fs.writeFileSync('public/quiz/' + name + '.png', svg);
});
console.log('created', missing.length, 'placeholder SVGs (saved as .png for uniform references)');
